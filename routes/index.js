
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Main' });
};

exports.multiple = function(req, res){
  res.render('multiple', { title: 'Multiple' });
};

exports.single = function(req, res){
  res.render('single', { title: 'Single' });
};