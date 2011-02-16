var https = require('https'),
    qs    = require('querystring'),
    env   = process.env;

var username   = env.KARMABOT_USERNAME,
    password   = env.KARMABOT_PASSWORD,
    useragent  = 'karmabot/1.1',
    playground = 5087,//5827
    forMe      = new RegExp('@' + username),
    handlers   = [],
    hash       = new Buffer(username + ':' + password).toString('base64');

var request = function(method, path, body, callback)
{
    var options = {
            host    : 'convore.com',
            headers : {
                'Authorization' : 'Basic ' + hash,
                'Content-Type'  : 'application/x-www-form-urlencoded',
                'User-Agent'    : useragent
            },
            method  : method,
            path    : path
        };

    if ( typeof body === 'function' )
    {
        callback = body;
        body = null;
    }

    if ( body && typeof body !== 'string' )
    {
        body = qs.stringify(body);
        if ( options.method === 'post' )
            options.headers['Content-Length'] = body.length;
        else
            options.path += '?' + body;
    }

    console.log(options.path);
    var req = https.request(options, function(res)
    {
        var data = '';
        switch ( res.statusCode )
        {
            case 200:
                if ( !callback ) return;
                res.on('data', function(chunk) { data += chunk });
                res.on('end', function()
                {
                    if ( res.headers['content-type'] === 'application/json' )
                        try {
                            data = JSON.parse(data);
                        }
                        catch (e) { console.log('parse error: ' + data) };
                    callback(data);
                });
                break;
            default:
                console.log(res.statusCode);
                res.on('data', function(chunk) { console.log(chunk) });
                process.exit(1);
        }
    });

    if ( body && options.method === 'post' )
        req.write(body);

    req.end();
}

var get = function(path, body, callback)
{
    request('get', path, body, callback);
}

var post = function(path, body, callback)
{
    request('post', path, body, callback);
}

var say = function(topic, message, callback)
{
    post('/api/topics/' + topic + '/messages/create.json', { message: message }, callback);
}

var stars = function(user, topic)
{
    request({ path: '/users/mal/', method: 'get' }, function(data)
    {
        var match = /<span class="label">Stars received<\/span>\s+<strong>(\d+)<\/strong>/.exec(data),
            stars = parseInt(match[1]);

        request(
            { path: '/api/topics/' + topic + '/messages/create.json', method: 'post' },
            { message: '@' + user + ' has ' + stars + ' stars!' }
        );
    });
}

var dispatch = function(msg)
{

    for ( var i in handlers )
    {
        var pattern = handlers[i][0],
            handler = handlers[i][1];

        if ( msg.user.username !== username && ( match = msg.message.match(pattern) ) )
        {
            msg.match = match;
            msg.say = function(message, callback)
            {
                say(msg.topic.id, message, callback);
            };
            handler(msg);
        }
    }
}

var listen = function(cursor)
{
    var body = { topic_id : playground };
    if ( typeof cursor === 'string' )
        body.cursor = cursor;
    get('/api/live.json', body, function(data)
    {
        for ( var i in data.messages )
        {
            var item = data.messages[i];
            if ( item.kind === 'message' )
            {
                if ( item.topic.id !== playground ) continue;
                if ( forMe.test(item.message) )
                    dispatch(item);
            }
            cursor = item._id;
        }
        listen(cursor);
    });
}

var command = function(phrase, callback)
{
    handlers.push([phrase, callback]);
}

get('/api/account/verify.json', listen);

command(/help/, function(msg)
{
    msg.say('I currently answer to \'star me\' and \'rate me\'. You can also ask me about my source and provoke to dual with evilbot');
});

command(/source|where do you live/, function(msg)
{
    msg.say('I live here: https://github.com/mal/karmabot');
})

command(/star me/, function(msg)
{
    get('/users/' + msg.user.username + '/', function(data)
    {
        var match = /<span class="label">Stars received<\/span>\s+<strong>(\d+)<\/strong>/.exec(data),
            stars = parseInt(match[1]);

        msg.say('@' + msg.user.username + ' has ' + stars + ' stars!');
    });
});

command(/rate me/, function(msg)
{
    get('/users/' + msg.user.username + '/', function(data)
    {
        var recieved = />Stars received<\/span>\s+<strong>(\d+)</.exec(data)[1],
            given    = />Stars given<\/span>\s+<strong>(\d+)</.exec(data)[1],
            rating   = Math.round(parseFloat(given) / parseFloat(recieved) * 1000) / 1000;

        msg.say('@' + msg.user.username + ' has a star give/take ratio of ' + rating + '!');
    }); 
});

command(/draw|dual|fight|kill|attack|freak out|slay|fruitsalad/i, function (msg)
{
    var ideas = ['banana', 'pistol', 'submachine gun', 'cuddly toy', 'M4', 'Rolf Harris', 'south china sea', 'ALIENS', 'banjo', 'KA-BOOM!!!'];
    msg.say('@evilbot image me ' + ideas[Math.floor(Math.random()*ideas.length)]);
});
