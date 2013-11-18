
var map_canvas = function() {

  var m = [30, 10, 10, 10],
    w = 960 - m[1] - m[3],
    h = 340 - m[0] - m[2];

  var x = d3.scale.ordinal().rangePoints([0, w], 1),
    y = {};

  var line = d3.svg.line(),
    axis = d3.svg.axis().orient("left"),
    background,
    foreground;

  d3.selectAll("canvas")
      .attr("width", w + m[1] + m[3])
      .attr("height", h + m[0] + m[2])
      .style("padding", m.join("px ") + "px");

  foreground = document.getElementById('foreground').getContext('2d');
  background = document.getElementById('background').getContext('2d');
  foreground.strokeStyle = "rgba(0,100,160,0.24)";
  background.strokeStyle = "rgba(0,0,0,0.02)";
  console.log("map_canvas ok ")
}