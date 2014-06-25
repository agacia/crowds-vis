
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.bodyParser());

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/explore', routes.explore);
app.get('/about', routes.about);
app.get('/multiple', routes.multiple);
app.get('/single', routes.single);
app.get('/single-cross', routes.singlecross);
app.get('/highway', routes.highway);
app.get('/community_detection', routes.community_detection);
app.get('/communities', routes.communities);
app.get('/dynamism', routes.dynamism);
app.get('/congestion', routes.congestion);
app.get('/voronoi', routes.voronoi);
app.get('/car2go', routes.car2go);
app.get('/car2go_sedimentation', routes.car2go_sedimentation);
app.get('/traffic', routes.traffic);
app.get('/users', user.list);

app.post('/voronoi/saveNetwork', routes.saveNetwork)

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
