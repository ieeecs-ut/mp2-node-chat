var app = {
    ws: {
        init: (resolve) => {
            app.ws.connect();
            if (resolve) resolve();
        },
        id: -1,
        socket: null,
        url:
            (window.location.hostname == "localhost" ? ("ws://localhost:30001") :
                ((location.protocol === 'https:'
                    ? 'wss://'
                    : 'ws://') +
                    document.domain +
                    (location.protocol === 'https:' ? ':443' : ':80') +
                    '/socket')),
        password: 'noopsonsiereht',
        events: {}, // event handlers
        encode_msg: function (e, d) {
            return JSON.stringify({
                event: e,
                data: d
            });
        },
        decode_msg: function (m) {
            try {
                m = JSON.parse(m);
            } catch (e) {
                console.log('[ws] invalid json msg ', e);
                m = null;
            }
            return m;
        },
        send: (event, data) => {
            app.ws.socket.send(app.ws.encode_msg(event, data));
        },
        // bind handler to client event
        bind: (event, handler) => {
            app.ws.events[event] = (data) => {
                handler(data);
            };
        },
        connect: function () {
            var socket = new WebSocket(app.ws.url);
            socket.addEventListener('open', function (e) {
                console.log('socket connected');
                if (app.ws.password) app.ws.login(app.ws.password);
            });
            socket.addEventListener('error', function (e) {
                console.log('socket error ', e.data);
            });
            socket.addEventListener('message', function (e) {
                var d = app.ws.decode_msg(e.data);
                if (d != null) {
                    console.log('message from server:', d.event, d.data);
                    if (app.ws.events.hasOwnProperty(d.event))
                        app.ws.events[d.event](d.data);
                    else console.log('unknown event', d.event);
                    switch (d.event) {
                        case 'auth':
                            if (d.data === true) {
                                console.log('socket authenticated');
                            } else {
                                console.log('socket failed to authenticate');
                            }
                            break;
                        default:
                            // console.log('unknown event', d.event);
                            break;
                    }
                } else {
                    console.log('message from server:', 'invalid message', e.data);
                }
            });
            socket.addEventListener('close', function (e) {
                console.log('socket disconnected');
                // alert('disconnected from server');
                app.ws.logout();
            });
            window.addEventListener('beforeunload', function (e) {
                // socket.close(1001);
            });
            app.ws.socket = socket;
        },
        login: (pass) => {
            app.ws.password = pass;
            app.ws.send('auth', { password: pass });
        },
        logout: function () {
            // window.location.reload();
            window.location.href = String(window.location.href);
        },
    },
    init: null,
    main: null,
    __init: (resolve) => {
        app.ws.init(_ => {
            if (resolve) resolve();
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

var username = '';


app.init = function (resolve) {

    // initialize the user interface


    // bind to websocket events
    app.ws.bind('auth', (auth) => {
        if (auth) {
            var new_name = prompt('What is your name?');
            if (new_name && new_name.trim().length > 1) {
                var req = {
                    name: new_name
                };
                app.ws.send('set_name', req);
            }
        }
    });
    app.ws.bind('set_name_response', (response) => {
        if (response && response.success && response.success === true) {
            username = response.name;
            console.log(`username set to ${username}`);
        };
    });

    if (resolve) resolve();
};

app.main = function () {

};


/* entry point */
app.__main();  // DON'T TOUCH THIS LINE