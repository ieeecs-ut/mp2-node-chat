/* NODE CHAT */

/* imports */
const http = require("http");
const express = require('express');
const websocket = require('ws');
const random_number = require("random-number");

/* constants */
const ws_port = 30001;
const web_port = 30000;
const password = "noopsonsiereht";

/* utilities module */
var util = {
    rand_id: (length = 10) => {
        var key = "";
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = 0; i < length; i++)
            key += chars[random_number({
                min: 0,
                max: chars.length - 1,
                integer: true
            })];
        return key;
    },
};

/*  web server module */
var web = {
    port: null,
    init: resolve => {
        web.port = web_port;
        web.api = express();
        web.server = http.Server(web.api);
        web.attach_cors();
        web.attach_home();
        web.server.listen(web.port, _ => {
            console.log("[web] listening on", web.port);
        });
        if (resolve) resolve();
    },
    attach_cors: () => {
        web.api.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header(
                "Access-Control-Allow-Headers",
                "Origin, X-Requested-With, Content-Type, Accept"
            );
            next();
        });
    },
    attach_home: _ => {
        web.api.use(express.static("static"));
        web.api.get("/", (req, res) => {
            res.sendFile(__dirname + "/static/index.html");
        });
    },
    api: null,
    server: null,

};

/* websocket server module */
var ws = {
    port: null,
    init: resolve => {
        ws.port = ws_port;
        ws.socket = new websocket.Server({ port: ws.port });
        ws.initialize();
        if (resolve) resolve();
    },
    socket: null,
    online: false,
    clients: {}, // client sockets
    events: {}, // event handlers
    // encode event+data to JSON
    encode_msg: (e, d) => {
        return JSON.stringify({
            event: e,
            data: d
        });
    },
    // decode event+data from JSON
    decode_msg: (m) => {
        try {
            m = JSON.parse(m);
        } catch (e) {
            console.log("[ws] invalid json msg", e);
            m = null;
        }
        return m;
    },
    // send data to specific authenticated client
    send_to_client: (event, data, client) => {
        client.socket.send(ws.encode_msg(event, data));
    },
    // send data to all authenticated clients
    send_to_clients: (event, data) => {
        for (var c_id in ws.clients) {
            if (
                ws.clients.hasOwnProperty(c_id) &&
                ws.clients[c_id] !== null &&
                ws.clients[c_id].auth
            ) {
                ws.clients[c_id].socket.send(ws.encode_msg(event, data));
            }
        }
    },
    // send data to almost all authenticated clients (excluding one)
    send_to_clients_except: (event, data, client) => {
        for (var c_id in ws.clients) {
            if (
                ws.clients.hasOwnProperty(c_id) &&
                c_id != client.id &&
                ws.clients[c_id] !== null &&
                ws.clients[c_id].auth
            ) {
                ws.clients[c_id].socket.send(ws.encode_msg(event, data));
            }
        }
    },
    // bind handler to client event
    bind: (event, handler, auth_req = true) => {
        ws.events[event] = (client, req, db) => {
            if (!auth_req || client.auth)
                handler(client, req, db);
        };
    },
    // initialize & attach core events
    initialize: _ => {
        // attach server socket events
        ws.socket.on("connection", (client_socket) => {
            // create client object on new connection
            var client = {
                socket: client_socket,
                id: util.rand_id(),
                auth: false,
                type: "app"
            };
            console.log(`[ws] client ${client.id} – connected`);
            // client socket event handlers
            client.socket.addEventListener("message", (m) => {
                var d = ws.decode_msg(m.data); // parse message
                if (d != null) {
                    // console.log('    ', d.event, d.data);
                    console.log(`[ws] client ${client.id} – message: ${d.event}`, d.data);
                    // handle various events
                    if (ws.events.hasOwnProperty(d.event))
                        ws.events[d.event](client, d.data);
                    else console.log("[ws] unknown event", d.event);
                } else {
                    console.log(`[ws] client ${client.id} – invalid message: `, m.data);
                }
            });
            client.socket.addEventListener("error", (e) => {
                console.log("[ws] client " + client.id + " – error", e);
            });
            client.socket.addEventListener("close", (c, r) => {
                console.log(`[ws] client ${client.id} – disconnected`);
                delete ws.clients[client.id]; // remove client object on disconnect
            });
            // add client object to client object list
            ws.clients[client.id] = client;
        });
        ws.socket.on("listening", _ => {
            console.log("[ws] listening on", ws.port);
            ws.online = true;
        });
        ws.socket.on("error", (e) => {
            console.log("[ws] server error", e);
            ws.online = false;
        });
        ws.socket.on("close", _ => {
            console.log("[ws] server closed");
            ws.online = false;
        });

        // attach client socket events
        ws.bind('auth', (client, req, db) => {
            // validate password
            if (req.password == password) {
                console.log(`[ws] client ${client.id} – authenticated`);
                // set auth in client object
                client.auth = true;
                if (client.type == "app") {
                    // if regular client
                    ws.send_to_client("auth", true, client); // confirm auth with client

                }
            }
        }, false);
    }
};

/* application main module */
var app = {
    init: null,
    main: null,
    __init: resolve => {
        web.init(_ => {
            ws.init(_ => {
                if (resolve) resolve();
            });
        });
    },
    __main: _ => {
        app.__init(_ => {
            app.init(_ => {
                app.main();
            });
        });
    }
};




/** USER CODE BELOW
 * 
 */

var users = {};
var messages = [];

app.init = function (resolve) {

    // bind to websocket events
    ws.bind('set_name', function (client, req) {
        if (req.name && req.name.trim().length > 1) {
            if (users[client.id]) {
                users[client.id].name = req.name;
            } else {
                users[client.id] = {
                    id: client.id,
                    name: req.name
                };
            }
            ws.send_to_client('set_name_response', {
                success: true,
                name: req.name
            }, client);
            console.log(`client ${client.id} is now user ${req.name}`);
        }
    });



    if (resolve) resolve();
};

app.main = function () {

};




/* entry point */
app.__main();  // DON'T TOUCH THIS LINE