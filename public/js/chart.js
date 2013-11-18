
var chart = function() {
  window.requestAnimFrame = (function(){
  return window.requestAnimationFrame       ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame    ||
         window.oRequestAnimationFrame      ||
         window.msRequestAnimationFrame     ||
         function( callback ){
           window.setTimeout(callback, 1000 / 60);
         };
})();

var m = [30, 10, 10, 10],
    w = 960 - m[1] - m[3],
    h = 340 - m[0] - m[2];

var x = d3.scale.ordinal().rangePoints([0, w], 1),
    y = {};

var line = d3.svg.line(),
    // axis = d3.svg.axis().orient("left"),
    foreground,
    dimensions,
    brush_count = 0;

var colors = {
  "Dairy and Egg Products": "hsla(28.13278008298755,100%,52.74509803921569%,0.12)",
  "Spices and Herbs": "hsla(214.13793103448276,55.769230769230745%,79.6078431372549%,0.12)",
  "Baby Foods": "hsla(0,0%,33.33333333333333%,0.12)",
  "Fats and Oils": "hsla(29.77777777777777,100%,73.52941176470588%,0.12)",
  "Poultry Products": "hsla(359.6571428571429,69.1699604743083%,49.6078431372549%,0.12)",
  "Soups, Sauces, and Gravies": "hsla(110.11764705882352,57.04697986577182%,70.7843137254902%,0.12)",
  "Vegetables and Vegetable Products": "hsla(120,56.86274509803921%,40%,0.12)",
  "Sausages and Luncheon Meats": "hsla(1.1428571428571388,100%,79.41176470588236%,0.12)",
  "Breakfast Cereals": "hsla(271.3953488372093,39.44954128440367%,57.25490196078431%,0.12)",
  "Fruits and Fruit Juices": "hsla(274.05405405405406,30.57851239669423%,76.27450980392156%,0.12)",
  "Nut and Seed Products": "hsla(10.153846153846157,30.23255813953488%,42.156862745098046%,0.12)",
  "Beverages": "hsla(10,28.915662650602407%,67.45098039215686%,0.12)",
  "Finfish and Shellfish Products": "hsla(318.3333333333333,65.85365853658534%,67.84313725490196%,0.12)",
  "Legumes and Legume Products": "hsla(334.15384615384613,80.24691358024694%,84.11764705882354%,0.12)",
  "Baked Products": "hsla(0,0%,49.80392156862745%,0.12)",
  "Sweets": "hsla(0,0%,78.03921568627452%,0.12)",
  "Cereal Grains and Pasta": "hsla(0,0%,0%,0.12)",
  "Fast Foods": "hsla(60,51.99999999999999%,70.58823529411764%,0.12)",
  "Meals, Entrees, and Sidedishes": "hsla(185.54347826086956,80%,45.09803921568628%,0.12)",
  "Snacks": "hsla(189.29577464788733,57.72357723577235%,75.88235294117646%,0.12)",
  "Ethnic Foods": "hsla(41.87919463087248,75.63451776649744%,61.372549019607845%,0.12)",
  "Restaurant Foods": "hsla(204.56375838926175,70.61611374407583%,41.372549019607845%,0.12)"
};

d3.selectAll("canvas")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .style("padding", m.join("px ") + "px");

foreground = document.getElementById('foreground').getContext('2d');

foreground.strokeStyle = "rgba(0,100,160,0.1)";

var svg = d3.select("svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
  .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

d3.csv("data/nutrients.csv", function(data) {

  // Extract the list of dimensions and create a scale for each.
  x.domain(dimensions = d3.keys(data[0]).filter(function(d) {
    return d != "name" && d != "group" &&(y[d] = d3.scale.linear()
        .domain(d3.extent(data, function(p) { return +p[d]; }))
        .range([h, 0]));
  }));

  // Render full foreground
  paths(data, foreground, brush_count);

  // Add a group element for each dimension.
  var g = svg.selectAll(".dimension")
      .data(dimensions)
    .enter().append("svg:g")
      .attr("class", "dimension")
      .attr("transform", function(d) { return "translate(" + x(d) + ")"; });

  // Add an axis and title.
  // g.append("svg:g")
  //     .attr("class", "axis")
  //     .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
  //   .append("svg:text")
  //     .attr("text-anchor", "middle")
  //     .attr("y", -9)
  //     .text(String);

  // Add and store a brush for each axis.
  g.append("svg:g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(y[d].brush = d3.svg.brush().y(y[d]).on("brush", brush)); })
    .selectAll("rect")
      .attr("x", -12)
      .attr("width", 24);

  // Handles a brush event, toggling the display of foreground lines.
  function brush() {
    brush_count++;
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });

    // Get lines within extents
    var selected = [];
    data.map(function(d) {
      return actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      }) ? selected.push(d) : null;
    });

    // Render selected lines
    foreground.clearRect(0,0,w+1,h+1);
    paths(selected, foreground, brush_count);
  }

  function paths(data, ctx, count) {
    var n = data.length,
        i = 0,
        reset = false;
    function render() {
      var max = d3.min([i+60, n]);
      data.slice(i,max).forEach(function(d) {
        path(d, foreground, colors[d.group]);
      });
      i = max;
    };
    (function animloop(){
      if (i >= n || count < brush_count) return;
      requestAnimFrame(animloop);
      render();
    })();
  };
});


function path(d, ctx, color) {
  if (color) ctx.strokeStyle = color;
  ctx.beginPath();
  dimensions.map(function(p,i) {
    if (i == 0) {
      ctx.moveTo(x(p),y[p](d[p]));
    } else { 
      ctx.lineTo(x(p),y[p](d[p]));
    }
  });
  ctx.stroke();
};
}