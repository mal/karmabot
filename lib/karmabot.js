var http  = require('http');
    https = require('https'),
    qs    = require('querystring'),
    env   = process.env;

var username   = env.KARMABOT_USERNAME,
    password   = env.KARMABOT_PASSWORD,
    useragent  = 'karmabot/1.1',
    playground = {5087:0,6269:0,6495:0},
    forMe      = new RegExp('^@?' + username),
    handlers   = [],
    hash       = new Buffer(username + ':' + password).toString('base64');

var request = function(method, path, body, callback)
{
    var protocol = https,
        options = {
            host    : 'convore.com',
            headers : {
                'Authorization' : 'Basic ' + hash,
                'Content-Type'  : 'application/x-www-form-urlencoded',
                'User-Agent'    : useragent
            },
            method  : method,
            path    : path
        };

    var url;
    if ( url = /^http(s)?:\/\/([^\/]+)(\/.*)/.exec(path) )
    {
        if ( !url[1] ) protocol = http;
        options.host = url[2];
        options.path = url[3];
        options.port = 80;
        delete options.headers;
        console.log(options);
    }

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

    var req = protocol.request(options, function(res)
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
    var body = {};// topic_id : playground };
    if ( typeof cursor === 'string' )
        body.cursor = cursor;
    get('/api/live.json', body, function(data)
    {
        for ( var i in data.messages )
        {
            var item = data.messages[i];
            if ( item.kind === 'message' )
            {
                if ( ! item.topic.id in playground ) continue;
                if ( forMe.test(item.message) )
                    dispatch(item);
                console.log(item.message);
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

command(/help/i, function(msg)
{
    msg.say('I currently answer to \'star me\' and \'rate me\'. You can also ask me about my source and provoke to dual with evilbot', function()
    {
        msg.say('You can also ask me to recommend something from the BBC\'s iPlayer');
    });
});

command(/source|where do you live/i, function(msg)
{
    msg.say('I live here: https://github.com/mal/karmabot');
})

command(/star me/i, function(msg)
{
    get('/users/' + msg.user.username + '/', function(data)
    {
        var match = />Stars received<\/span>\s+<strong>(\d+)</.exec(data),
            stars = parseInt(match[1]);

        msg.say('@' + msg.user.username + ' has ' + stars + ' stars!');
    });
});

command(/rate me/i, function(msg)
{
    get('/users/' + msg.user.username + '/', function(data)
    {
        var recieved = />Stars received<\/span>\s+<strong>(\d+)</.exec(data)[1],
            given    = />Stars given<\/span>\s+<strong>(\d+)</.exec(data)[1],
            rating   = Math.round(parseFloat(given) / parseFloat(recieved) * 1000) / 1000;

        msg.say('@' + msg.user.username + ' has a star give/take ratio of ' + rating + '!');
    }); 
});

command(/\b(?:draw|dual|fight|kill|attack|freak out|slay|fruitsalad)\b/i, function (msg)
{
    var ideas = ['banana', 'pistol', 'submachine gun', 'cuddly toy', 'M4', 'Rolf Harris', 'south china sea', 'ALIENS', 'banjo', 'KA-BOOM!!!'];
    msg.say('@evilbot image me ' + ideas[Math.floor(Math.random()*ideas.length)]);
});

command(/\b(?:bbc|iplayer)\b/i, function(msg)
{
    get('http://feeds.bbc.co.uk/iplayer/highlights/tv', function(data)
    {
        var playlist = [],
            pattern = /<link rel=\"alternate\" href="([^"]+)" type=\"text\/html\" title=\"([^"]+)\">\s+<media:content>\s+<media:thumbnail url="([^"]+)"/g,
            epi;

        while( epi = pattern.exec(data) )
        {
            epi.shift();
            playlist.push(epi);
        }

        epi = playlist[Math.floor(Math.random()*playlist.length)];
        msg.say('The BBC suggests ' + epi[1] + ', you can view it now on iPlayer here: ' + epi[0], function()
        {
            msg.say(epi[2]);
        });
    });
});
