function lineChart() {
  var margin = {top: 20, right: 20, bottom: 20, left: 35},
      width = 760,
      height = 200,
      xValue = function(d) { return d[xMetric]; },
      yValue = function(d) { return d[yMetric]; },
      xScale = d3.scale.linear(),
      yScale = d3.scale.linear(),
      yScaleMax = 0, yScaleMin = 0,
      xAxis = d3.svg.axis().scale(xScale).orient("bottom").tickSize(6, 0),
      yAxis = d3.svg.axis().scale(yScale).orient("left"),
      area = d3.svg.area().x(X).y1(Y),
      line = d3.svg.line().x(X).y(Y),
      xMetric = "step",
      yMetric = "com_count",
      data = [],
      svg

  function chart(selection) {
    selection.each(function(selectionData) {
      data = selectionData;
      // console.log("draw for metric", yMetric,  "yScaleMin", yScaleMin, "yScaleMax", yScaleMax, "data", data)
      // Update the x-scale.
      xScale
          .domain([0, d3.max(data, function(d) { return d[xMetric]; })])
          .range([0, width - margin.left - margin.right]);

      // Update the y-scale.
      yMax = yScaleMax ? yScaleMax : d3.max(data, function(d) { return d[yMetric]});
      yMin = yScaleMin ? yScaleMin : d3.min(data, function(d) { return d[yMetric]});
      
      yScale
          .domain([yMin, yMax])
          .range([height - margin.top - margin.bottom, 0]);

      // Select the svg element, if it exists.
      svg = d3.select(this).selectAll("svg").data([data]);

      // Otherwise, create the skeletal chart.
      var gEnter = svg.enter().append("svg").append("g");
      gEnter.append("path").attr("class", "area");
      gEnter.append("path").attr("class", "line");
      gEnter.append("g").attr("class", "x axis");
      gEnter.append("g").attr("class", "y axis");

      // Update the outer dimensions.
      svg .attr("width", width)
          .attr("height", height);

      // Update the inner dimensions.
      var g = svg.select("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Update the area path.
      g.select(".area")
        .transition()
        .attr("d", area.y0(yScale.range()[0]));

      // Update the line path.
      g.select(".line")
        .transition()
        .attr("d", line);

      // Update the x-axis.
      g.select(".x.axis")
          .attr("transform", "translate(0," + yScale.range()[0] + ")")
          .call(xAxis);

      // Update the y-axis.
      g.select(".y.axis")
        .attr("transform", "translate(" + 0 + ",0)")
        .call(yAxis);

    });
  }

  // function updateYScale() {
  //   yScale.domain([0, d3.max(data, function(d) { return d[yMetric]; })])
  // }

  // The x-accessor for the path generator; xScale âˆ˜ xValue.
  function X(d) {
    return xScale(d[xMetric]);
  }

  // The x-accessor for the path generator; yScale âˆ˜ yValue.
  function Y(d) {
    return yScale(d[yMetric]);
  }

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return xValue;
    xValue = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return yValue;
    yValue = _;
    return chart;
  };

  chart.update = function(metric, min, max) {
    yMetric = metric;
    yScaleMax = max;
    yScaleMin = min;
    // update y scale
    yMax = yScaleMax ? yScaleMax : d3.max(data, function(d) { return d[yMetric]; });
    yMin = yScaleMin ? yScaleMin : d3.min(data, function(d) { return d[yMetric]; });
    yScale.domain([yMin, yMax])
    // console.log("update with metric ", yMetric, " yMax ", yScaleMax)
    
    var g = svg.select("g")
    // Update the area path.
    g.select(".area")
      .transition().ease("linear").duration(600)
      .attr("d", area.y0(yScale.range()[0]));

    // Update the line path.
    g.select(".line")
      .transition().ease("linear").duration(600)
      .attr("d", line);

    // Update the y-axis.
    yAxis = d3.svg.axis().scale(yScale).orient("left");
    g.select(".y.axis")
      .attr("transform", "translate(" + 0 + ",0)")
      .call(yAxis);
  }

  chart.yMetric = function(_) {
    if (_ === yMetric) return
    yMetric = _
  }

  return chart;
}