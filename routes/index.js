
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Main' });
};

exports.explore = function(req, res){
  res.render('explore', { title: 'Explore' });
};

exports.about = function(req, res){
  res.render('about', { title: 'About' });
};

exports.multiple = function(req, res){
  res.render('multiple', { title: 'Multiple' });
};

exports.single = function(req, res){
  res.render('single', { title: 'Single' });
};

exports.singlecross = function(req, res){
  res.render('single-cross', { title: 'Single' });
};

exports.traffic = function(req, res){
  res.render('traffic', { title: 'Traffic' });
};

exports.highway = function(req, res){
  res.render('highway', { title: 'Highway' });
};

exports.car2go = function(req, res){
  res.render('car2go', { title: 'Car2go' });
};

exports.communities = function(req, res){
  res.render('communities', { title: 'Community analysis' });
};

exports.congestion = function(req, res){
  res.render('congestion', { title: 'Congestion propagation' });
};