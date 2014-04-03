window.onload = function() {
  var 
        width = parseInt(d3.select(".vis-column").style("width")),
        height = areaRatio * width
        , vis = d3.select('body #visualisation').append('svg').attr('class', 'vis')
          .style({ width: '100%', height: height + 'px' })
        , node, max, margin = 0, max_area = 800, tooltip
        , margin_top = 0, margin_bottom  = 0
        , areaRatio = 1
        , steps_x = 100, steps_y = 28
        , calcBestArea = function(areaRatio){
          var r1 = (width ) 
            , r2 = (height)
            , r = r1 > r2 ? r2 : r1
            w = r1;
            h = areaRatio * r1;
            if (h > r2) {
              w = r;
              h = areaRatio * r;
            }
            d3.select('.vis').style({ width: w+ 'px', height: h+ 'px'})
            return {"r":r, "width":w, "height":h}
        }
        , max_area = calcBestArea(areaRatio).r
        , areaScale = d3.scale.linear().range([0, max_area])
        , xScale = d3.scale.linear().range([margin, max_area - margin])
        , yScale = d3.scale.linear().range([margin_top, max_area - margin_bottom - margin_top])
        , maxY = 0
        , areaToRadius = function(area, scale){ return Math.sqrt( scale * area / Math.PI) }
        , fisheye = null
        , fisheye = d3.fisheye.circular().radius(20).distortion(5)
        , colorScales = {
          "com_id": d3.scale.category20(),
          "avg_speed": d3.scale.linear().range(["red","yellow","green"]),
          "speed": d3.scale.linear().range(["red","yellow","green"]),
          "avg_speed_avg": d3.scale.linear().range(["red","yellow","green"]),
          "avg_speed_std": d3.scale.linear().range(["red","yellow","green"]),
          "num_stops": d3.scale.linear().range(["green","yellow","red"]),
          "congested_sum": d3.scale.linear().range(["green","yellow", "red"])}
        , colorMetric = 'com_id'
        , sortMetric = $('.sort-by').val()
        , colorMetric = $('.color-by').val()
        , algorithm = $('.algorithm-select').val()
        , firstStep = 0, step = 0, lastStep = 0, stepSize = 0
        , id = 0, order = 0
        , filter = ""
        , radius = function(d) { 
            var metric = sortMetric
            var scale = 1 
            if (metric == "avg_speed") {
              scale = 0.2;
              if (d[metric] < 0) {
                 return areaToRadius(0.1, scale)
              }
            }
            if (metric == "cos_score" || metric == "com_size") {
              scale = 0.4;
              if (d[metric] < 0) {
                 return areaToRadius(0.1, scale)
              }
            }
            if (metric === "None") {
              return 5;
            }
            if (vehicles && vehicles[step].length > 0) {
              if (!(metric in d)) {
                var communities = communitiesDimensions[step].top(Infinity);
                var com = communities.filter(function(c, i) { return c.com_id == d.com_id; })[0];
                return areaToRadius(areaScale(com[metric]), scale) 
              }
            }            
            return areaToRadius(areaScale(d[metric]), scale) 
          }
        , dataKey = function(d){ return d.node_id }
        , format = function(d) { // when read cvs
            var numKeys = ['node_id', 'step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size', 'speed', 'num_stops', 'is_originator'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            d.id = d.node_id;
            return d;
        }
        , formatGroup = function(d){ // when read cvs
            var numKeys = ['step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            d.order = order++;
            return d;
        }
        , stepsOffset = 1689
        , formatStep = function(step) {
          var seconds = step*stepSize + stepsOffset
          // if ((lastStep - firstStep) > 120) {
          //  return (seconds/60).toFixed(2) + " min"
          // }
          return seconds + " s"
        }
        , topNode = null
        , rootUrl = 'data/'
        , scenario = ""
        , slider
        , dateLabel = $("<div/>")
                    .css({ position : 'absolute' , top : 0, left : 0, width: "60px"})
                    .text(formatStep(step))
        , vehicles = {}
        , timer
        , timerDelay = 100
        , trackedNode = 0
        , trackedCommunityId = 0
        , staticTooltips = {}
        , communitiesDimensions = {}
        , monsterSortMetric = "count"
        , tip = new InfoTooltip()
        , communities = []

      if ( window.self !== window.top ){
        // we're in an iframe!
      }

      tip(".project-info")
      tip.show();
      createstaticTooltips();
      init();

      function init() {
        pause();
        d3.select("#staticTooltips").attr('display', 'none')
        // loadFile(rootUrl + scenario + "/" + algorithm + "communities.csv", "#loaderVeh", gotVehicles);
        // loadFile(rootUrl + scenario + "/" + algorithm + "communities_pandas.tsv", "#loaderCom", gotCommunities);
        var q = queue(1);
        q.defer(loadFile, rootUrl + algorithm + "communities_pandas.tsv", "#loaderCom") //, gotCommunities) 
        q.defer(loadFile, rootUrl + algorithm + "communities.csv", "#loaderVeh") // , gotVehicles) 
        q.awaitAll(gotAllData);
        if (algorithm.indexOf("Highway") != -1) {
          areaRatio = 0.1;
          margin_top = 10;
        }
        else if (algorithm.indexOf("Manhattan") != -1) {
          areaRatio = 1;
          margin_top = 0;
        } else if (algorithm.indexOf("Kirchberg") != -1) {
          areaRatio = 0.5;
          margin_top = 0;
        }
      }
      function gotAllData(error, results) {
        tip.hide();
        if (!results) {
          return;
        }
        if (results.length == 1) {
          gotVehicles(error, results[0]);
          return;
        }
        gotCommunities(error, results[0]);
        gotVehicles(error, results[1]);
      }

      function loadFile(url, loader, cb) {
        $(loader).show()
        var xhr = d3.tsv(url)
          .row(format)
          .on("progress", function(pe) { 
            if(pe) {
              var total = Math.round(d3.event.total/1024)
              var loaded = Math.round(d3.event.loaded/1024)
              var unit = " kB"
              if (loaded > 1000) {
                total = Math.round(d3.event.total/1048576);
                loaded = Math.round(d3.event.loaded/1048576);
                unit = unit = " MB"
              }
              d3.select(loader + ' .size').html( loaded + "/ " + total + unit)
              d3.select(loader + ' .progress-bar').attr('max', d3.event.total);
              d3.select(loader + ' .progress-bar').attr('value', d3.event.loaded);
            }
          })
          .on("load", function(data) { 
            $(loader).hide();
            tip.hide();
            $('.error').html("");
            // d3.select('body').selectAll('.chart').selectAll().remove()
            d3.select(".data-status").html("Loaded " + data.length + " rows of data...")
            cb(null, data)
          })
          .on("error", function(error) { 
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm + " " + url);
            cb(null, [])
          })
          .get();
      }


      function gotCommunities(error, data) {
        console.log("got communities data", data)
        data = data.map(function(d) {
          com = {}
          if ("('step', '')" in d) {
            com.step = +d["('step', '')"]
            com.com_id = +d["('com_id', '')"]
            com.count = +d["('com_size', 'size')"]
            com.range = +d["('range', '')"]
            com.speed_avg = +d["('speed', 'mean')"]
            com.speed_min = +d["('speed', 'amin')"]
            com.speed_max = +d["('speed', 'amax')"]
            com.speed_std = +d["('speed', 'std')"]
            com.avg_speed_avg = +d["('avg_speed', 'mean')"]
            com.avg_speed_min = +d["('avg_speed', 'amin')"]
            com.avg_speed_max = +d["('avg_speed', 'amax')"]
            com.avg_speed_std = +d["('avg_speed', 'std')"]
            com.num_stops_sum = +d["('num_stops', 'sum')"]
            com.num_stops_avg = +d["('num_stops', 'mean')"]
            com.num_stops_min = +d["('num_stops', 'amin')"]
            com.num_stops_max = +d["('num_stops', 'amax')"]
            com.num_stops_std = +d["('num_stops', 'std')"]
            com.congested_sum = +d["('congested', 'sum')"]
          }
          else if ("step" in d) {
             // degree_mean degree_std  degree_amin degree_amax 
             // x_amin  x_amax  y_amin  y_amax
             // congested  num_stops_count
            com.step = +d["step"]
            com.com_id = +d["com_id"]
            com.count = +d["com_size"]
            com.range = +d["range"]
            com.speed_avg = +d["speed_mean"]
            com.speed_min = +d["speed_amin"]
            com.speed_max = +d["speed_amax"]
            com.speed_std = +d["speed_std"]
            com.avg_speed_avg = +d["avg_speed_mean"] || +d["timeMeanSpeed_mean"]
            com.avg_speed_min = +d["avg_speed_amin"] || +d["timeMeanSpeed_amin"]
            com.avg_speed_max = +d["avg_speed_amax"] || +d["timeMeanSpeed_amax"]
            com.avg_speed_std = +d["avg_speed_std"] || +d["timeMeanSpeed_std"]
            com.num_stops_sum = +d["num_stops"]
            com.num_stops_avg = +d["num_stops_mean"]
            com.num_stops_min = +d["num_stops_amin"]
            com.num_stops_max = +d["num_stops_amax"]
            com.congested_sum = +d["congested"]
           }
           return com;
        })
        communities= d3.nest()
          .key(function(d) { return d.step; })
          .entries(data);

        createMonsters(step/stepSize)
      }
      function gotVehicles(error, data) {
        data.forEach(function(d){
          d.step = +d.step;
          d.avg_speed = +d.timeMeanSpeed
        })
        vehicles = d3.nest()
          .key(function(d) { return d.step; })
          .entries(data);

        if (vehicles.length > 0) {
          firstStep = +vehicles[0].key;
          lastStep = +vehicles[vehicles.length-1].key;
          step = firstStep;
        }
        stepSize = 1;
        if (vehicles.length > 1) {
          stepSize = +vehicles[1].key - firstStep;
        }
        initialiseSlider(firstStep/stepSize, (lastStep-1)/stepSize, 1, onStepUpdated)
         
        for (time in vehicles) {
          if (communities.length > 0) {
            var stepCommunities = communities[time].values;
            vehicles[time].values.forEach(function(d) {
              var com = stepCommunities.filter(function(c) { return c.com_id == d.com_id}) 
              if(com.length > 0) {
                d["speed_avg"] = com[0].speed_avg;
                d["avg_speed_std"] = com[0].avg_speed_std;
                d["avg_speed_avg"] = com[0].avg_speed_avg;
                d["congested_sum"] = com[0].congested_sum
              }
            })
          }
        }

        updateColorScales(data);
        updateMaxArea(areaRatio);
        updateAreaScales(data);

        if (vehicles && step in vehicles) {
          showVehicles(vehicles[step].values)
        }
        initialiseMonsterTracker();

        // createChart("#num-vehicles", "Step", "Number of vehicles", timeDimension, timeGroup, "step", "count", firstStep, lastStep)
        // createChart("#num-stops", "Step", "Number of congestion reports", timeDimension, timeGroup, "step", "stops_count", firstStep, lastStep)
           
      }

      populateAlgorithmOption()

      function populateAlgorithmOption() {
        var dirname = "Kirchberg/30032014/avgspeed_"
        var algorithms = []
        var thresholdStart = 1
        var thresholdStep = 1
        var thresholdStop = 2
        var historylengthStart = 10
        var historylengthStep = 10
        var historylengthStop = 20
        for (var i = thresholdStart; i < thresholdStop; i += thresholdStep) {
          for (var j = historylengthStart; j < historylengthStop; j += historylengthStep) {
            algorithms.push({"value":dirname+"thres"+i+"_hist"+j+"/", "title": "Kirchberg, threshold " + i +", history " + j} )
          }
        }
         
        var options = d3.select(".algorithm-select").selectAll("option")[0]
        options = options.concat(algorithms)
        algOption = d3.select(".algorithm-select").selectAll("option")
          .data(options)
          .enter()
          .append("option")
            .attr("value", function(d) { return d.value })
            .text(function(d) { return d.title })

        $('.algorithm-select').on('change', function(){
          var newAlgorithm = $(this).val()
          if (algorithm === newAlgorithm) return
          algorithm = newAlgorithm;
          init();  
        })
            
      }

      function updateAreaScales(data) {
        minX = d3.min(data, function(d) {return d.x; })
        maxX = d3.max(data, function(d) {return d.x; })
        minY = d3.min(data, function(d) {return d.y; })
        maxY = d3.max(data, function(d) {return d.y; })
        xScale.domain([minX,maxX])
        yScale.domain([minY,maxY])
      }
      
      function updateAreaScale(metric){
        if (metric === "None") {
          areaScale.domain([0, 10])
        } else if (vehicles && vehicles[step/stepSize].values.length > 0) {
          areaScale.domain([0, d3.max(vehicles[step/stepSize].values,function(d){ return d[metric] }) ])
        }
      }

      function updateColorScales(data) {
        d3.selectAll(".legend-item").remove();

        for (var metric in colorScales) {
          if (metric != "com_id") {
            var maxVal = d3.max(data, function(d){ return d[metric] })
            var minVal = d3.min(data, function(d){ return d[metric] })
            colorScales[metric].domain([minVal, maxVal])  
            var colors = []
            var scaleLen = colorScales[metric].range().length;
            if (scaleLen < 9) {
              scaleLen = 9
            }
            colorScales[metric].domain([minVal, (maxVal-minVal)/2, maxVal])
                        var interval = (maxVal - minVal)/scaleLen;
            for (var i in d3.range(scaleLen)) {
              var value = minVal + i * interval;
              colors.push({"value":Math.round(value), "color":colorScales[metric](value)})
            }
            createLegend(metric, colors)
          }
        }
      }

      function createLegend(metric, colors) {
        var legend = d3.select(".legend").append("div")
          .attr("class", "legend-item " + metric)
        legend.append('span')
          .attr('class','title')
          .text(metric)
        legend.append('span')
          .attr('class','colors')
        legend.selectAll('.color-item')
          .data(colors) 
          .enter()
          .append('span') 
            .attr('class', 'color-item')
            .style('width', 30+"px")
            .style('height', 20+"px")
            .style('display', "inline-block")
            .style('background-color', function(d) { return d.color })
            .text(function(d) { return d.value })
      }

      function initialiseSlider(firstStep, lastStep, stepSize, callback) {
        $(".slider").slider()
        $(".slider").slider()
          .find(".ui-slider-handle")
          .append(dateLabel)
         slider = $( ".slider" ).slider({
              min: firstStep,
              max: lastStep,
              step: stepSize,
              value: firstStep,
              slide: function( event, ui ) { 
                step = ui.value; 
                callback()
              }
            })
      }
      function onStepUpdated() {
        showVehicles(vehicles[step].values)
        dateLabel.text(formatStep(step))        
        updatestaticTooltips(step);
        createMonsters(step);
      }
      function drawVehicleCharts(cf) {
        var vehicleDimension = cf.dimension(function(d) {
          d.speed = +d.speed;
          d.num_stops = +d.num_stops;
          return +d.node_id;
        })
        var vehicleGroup = vehicleDimension.group().reduceCount();
        var groups = vehicleGroup.all();
        var sum = 0;
        for (var vehicle in groups) {
          sum += groups[vehicle].value
        }
        var average = (sum / groups.length).toFixed(2);
        var stdDeviation = 0
        for (var vehicle in groups) {
          deviation = Math.pow(groups[vehicle].value - average, 2)
          stdDeviation += deviation;
        }
        stdDeviation = Math.sqrt(stdDeviation / groups.length).toFixed(2)
        // vehicleGroup.all().reduce(function(previousValue, currentValue) { return previousValue.sum + previousValue. });
        d3.select("#stats").append("div").html("Total number of vehicles: " + groups.length);
        d3.select("#stats").append("div").html("Average seconds traveled: " + average);
        d3.select("#stats").append("div").html("Standard deviation: " + stdDeviation);
        d3.select("#stats").append("div").html("Total seconds traveled: " + sum);

        var cf2 = crossfilter(groups)
        var hist = cf2.dimension(function(d) { return d.value})
        var count = hist.group();

        var numBins = 30;
        var binWidth = (count.all().length) / numBins;
        var count = hist.group(function(d) {return Math.floor(d / binWidth) * binWidth;});
        drawHistogram("#hist-vehicles", "Trip duration", "Number of vehicles", hist, count, numBins, binWidth)
            
        d3.select(".data-status").style("display", "none")
      } 
      function drawHistogram(selection, xLabel, yLabel, dimension, group, nBins, binWidth) {
        counts = group.all();
        var xMin = counts[0].key
        var xMax = counts[counts.length-1].key;
        var chart = dc.barChart(selection);
        chart
          .height(160)
          .x(d3.scale.linear().domain([xMin,xMax]))
          .title(function(p) {
              return 
                  "Number of vehicles: " + numberFormat(p.value) + "\n"
                  + "that travel between : " + numberFormat(p.key) + " and " + numberFormat(p.key)+binWidth + "\n"
          })
          .renderTitle(true)
          .yAxisLabel(yLabel)
          .brushOn(false)
          // .dimension(dimension)
          .dimension(group)
          .keyAccessor(function(d) { return d.key; })
          .group(group)
          .valueAccessor(function (d) { return d.value; })
          .renderLabel(true)
          .transitionDuration(1500)
          .elasticY(true)
          // .xUnits(function(){return 1;});
        chart.margins().left = 50;
        chart.render();
        // renderlet function
        chart.renderlet(function(chart){
            // mix of dc API and d3 manipulation
            d3.select(".charts-status").style("display", "none");
            dc.events.trigger(function(){
              // focus some other chart to the range selected by user on this chart
              // someOtherChart.focus(chart.filter());
            });
            // moveChart.filter(chart.filter());
        });
        var tip = d3.tip()
          .attr('class', 'd3-tip')
          .offset([-10, 0])
          .html(function(d) {
            return "<strong>Frequency:</strong> <span style='color:red'>" + d.frequency + "</span>";
          })
        tip = d3.tip().attr('class', 'd3-tip').html(function(d) { return d; });

        /* Invoke the tip in the context of your visualization */
        var histVis = d3.select("#hist-vehicles svg")
        histVis.call(tip)
        histVis.selectAll('.bar')
          .on('mouseover', tip.show)
          .on('mouseout', tip.hide)
      }

      function createChart(selection, xLabel, yLabel, dimension, group, keyAccessor, valueAccessor, xMin, xMax) {
        var chart = dc.lineChart(selection);
        chart
          .width(580)
          .height(160)
          .x(d3.scale.linear().domain([xMin,xMax]))
          // .interpolate('step-before')
          .renderArea(false)
          .brushOn(false)
          // .renderDataPoints(false)
          .yAxisLabel(yLabel)
          .dimension(dimension)
          // .dimension(group)
          // .keyAccessor(function(d) { return d.key * groupSize; })
          .group(group)
          .valueAccessor(function (d) {
            return d.value[valueAccessor];
          })
          .renderTitle(true)
          .title(function(d){
            return "Step: " + d.key
            + "\n" + valueAccessor + ": " + d.value[valueAccessor];
            })
          // .title(function(p) {
          //     return 
          //         "Step: " + numberFormat(p[keyAccessor]) + "\n"
          //         + "Value : " + numberFormat(p.value[valueAccessor]) + "\n"
          // })
          .renderLabel(true)
          .transitionDuration(1500)
          .elasticY(true)

        chart.margins().left = 50;
        chart.render();
        // renderlet function
        chart.renderlet(function(chart){
            // mix of dc API and d3 manipulation
            d3.select(".charts-status").style("display", "none");
            dc.events.trigger(function(){
              // focus some other chart to the range selected by user on this chart
              // someOtherChart.focus(chart.filter());
            });
            // moveChart.filter(chart.filter());
        });
      }
      function showVehicles(veh) { 
        if (filter && filter!="") {
          veh = veh.filter(function(d){ return d[filter] < 5; })
        }
        var exitNodes = vis.selectAll('.node').data(veh, dataKey).exit()
        exitNodes.remove();
        newNodes = vis.selectAll('.node').data(veh, dataKey)
          .enter()
            .append('g')
            .attr('class', 'node')  
        newNodes.on('click', function(){
          var node // = d3.select('.node.highlighted').classed('highlighted', false).node()
            , sel = d3.select(this)
          if(sel.node() !== node) sel.classed('selected', !d3.select(this).classed('selected'))
          var startTracking = d3.select(this).classed('selected')
          if (startTracking) {
            d3.select('.staticTooltip.vehicle').style('display', 'block')
            d3.select('.staticTooltip.community').style('display', 'block')
            trackedNode = sel
            trackedCommunityId = sel.data()[0].com_id
            updatestaticTooltips(step);
          }
          else {
            trackedNode = 0
            d3.select('.staticTooltip.vehicle').style('display', 'none')
          }
        })
        newNodes.append('circle')
        node = vis.selectAll('.node')
        node
          .call(updatePos) 
          .call(updateColor)
        fisheyeEffect(vis)
      }
     
      function updateAreaScale(metric){
        if (metric === "None") {
          areaScale.domain([0, 10])
        } else {
          if (vehicles && vehicles[step].length > 0) {
            if (metric in vehicles[step][0]) {
              areaScale.domain([0, d3.max(vehicles[step],function(d){ return d[metric] }) ])
            }
            else {
              var communities = communitiesDimensions[step].top(Infinity);
              areaScale.domain([0, d3.max(communities,function(d){ return d[metric] }) ])
            }
          }
        }
      }
      function updateColorScale(metric){
        for (var i in colorScales) {
          // if (i !== "avg_speed") {
            if (vehicles && vehicles[step].length > 0) {
              if (metric in vehicles[step][0]) {
                colorScales[i].domain([0, d3.max(vehicles[step],function(d){ return d[metric] }) ])
              }
              else {
                var communities = communitiesDimensions[step].top(Infinity);
                colorScales[i].domain([0, d3.max(communities,function(d){ return d[metric] }) ])
              }
            }
          // }
        }
      }
      function initialiseMonsterTracker() {
        d3.selectAll('.icon-monster-community').remove()
        d3.selectAll('.icon-originator-community').remove()
        d3.select('.monsters.tracker .icon')
          .append('svg').attr('class', 'icon-monster-community') 
          .append('g')
          .attr('class', 'node monster-community') 
              .attr('transform', 'translate(' + 10 + ',' + 8 + ')')
              .append('circle').attr('r', 5)
        $("#trackMonsterToggle").prop('checked') ? $('.monsters.tracker .icon').show() : $('.monsters.tracker .icon').hide();
        $("#trackMonsterToggle").on('click', function(d) {
          $("#trackMonsterToggle").prop('checked') ? $('.monsters.tracker .icon').show() : $('.monsters.tracker .icon').hide();
          updateMonsterCommunity()
        });
        d3.select('.originators.tracker .icon').append('svg').attr('class', 'icon-originator-community') 
              .append('g').attr('class', 'node originator') 
              .attr('transform', 'translate(' + 10 + ',' + 8 + ')')
              .append('circle').attr('r', 5)
        $("#showOriginatorsToggle").prop('checked') ? $('.originators.tracker .icon').show() : $('.originators.tracker .icon').hide();
        $("#showOriginatorsToggle").on('click', function(d) {
          var trackOriginators = $("#showOriginatorsToggle").prop('checked') 
          if (trackOriginators) {
            $('.originators.tracker .icon').show() 
            vis.selectAll(".node").classed("originator", function(d) {
              return d.is_originator;
            })
          } 
          else {
            $('.originators.tracker .icon').hide();
            vis.selectAll(".node").classed("originator", false)
          }
        });
        // initialize filters
        $(".filter.toggle").on('click', function(d) {
          if ($("#filterSpeedToggle").prop('checked')) {
            filter = "speed"
          } 
          else if ($("#filterCommunityAvgSpeedToggle").prop('checked')) {
            filter = "speed_avg"
          } 
          else if ($("#filterTimeMeanSpeedToggle").prop('checked')) {
            filter = "timeMeanSpeed"
          }
          else if ($("#filterAvgCommunityTimeMeanSpeedToggle").prop('checked')) {
            filter = "avg_speed_avg"
          }
          else {
            filter = ""
          }
          showVehicles(vehicles[step].values)
        });
      }
      function orderValue(p) {
        return p[monsterSortMetric];
      }

      function createMonsters(step, asc) {
        asc = asc || false;
        if (step in communities) {
            d3.select(".communities-stats")
              .select('.num-communities').text("Number of communities: " + communities[step].values.length)
            var cf = crossfilter(communities[step].values);
            var dim = cf.dimension(function(d) {
              return d.count;
            })
            var monsterTable = dc.dataTable("#dc-monster-graph");
            monsterTable.width(800).height(800)
            .dimension(dim)
            .group(function(d) { return ""})
            .size(20)
            .columns([
              function(d) { return d.com_id },
              function(d) { return d.count },
              // function(d) { return parseFloat(d.speed_avg).toFixed(2) },
              // function(d) { return parseFloat(d.speed_std).toFixed(2) },
              function(d) { return parseFloat(d.avg_speed_avg).toFixed(2) },
              function(d) { return parseFloat(d.avg_speed_std).toFixed(2) },
              // function(d) { return parseFloat(d.num_stops_sum).toFixed(2) },
              function(d) { return parseFloat(d.congested_sum).toFixed(2) },
              function(d) { return '<svg><g class="node" transform="translate(10,10)" style="fill:'+colorScales["com_id"](d.com_id)+'"><circle r="5"></circle>/g></svg>' }
            ])
            .sortBy(orderValue)
          if (asc == true) {
            monsterTable.order(d3.ascending);
          }
          else {
            monsterTable.order(d3.descending);
          }
          monsterTable.render();
          $(".dc-table-row").on('mouseover',function(e) {
              var selectedComId = d3.select(this).select(".dc-table-column._0").html()
              var selectedCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==selectedComId ? d : null });
              vis.selectAll('.node').classed('selected-community',false); 
              selectedCommunityNodes.classed('selected-community',true); 
          });
          $("th .sort").on('click', function(d) {
            monsterSortMetric = $(this).parent().attr('class')
            d3.select(this).classed('asc', !d3.select(this).classed('asc'));
            var asc = d3.select(this).classed('asc')
            if (asc == true) {
              monsterTable.order(d3.ascending);
            }
            else {
              monsterTable.order(d3.descending);
            }
            monsterTable.sortBy(orderValue);
            monsterTable.redraw(); 
          });
          updateMonsterCommunity();  
      //   if (vehicles && vehicles[step] && vehicles[step].length > 0) {
      //     var cf = crossfilter(vehicles[step])
      //     var communitiesDimension = cf.dimension(function(d) { return d.com_id });
      //     var groupCommunities = communitiesDimension.group().reduce(
      //       function(p,v) { // add
      //         ++p.count;
      //         if (v.num_stops > 1) { ++p.stops_count }
      //         p.speed_sum += v.speed
      //         p.speed_avg = p.speed_sum / p.count;
      //         p.id = v.com_id;
      //         return p;
      //       },
      //       function(p,v) { // remove
      //         --p.count;
      //         if (v[metric] > 0) { --p.stops_count }
      //         p.speed_sum -= v.speed_sum;
      //         p.speed_avg = p.speed_sum / p.count;
      //         return p;
      //       },
      //       function() { // init
      //         return { id: 0, count: 0, speed_sum: 0, speed_avg: 0, stops_count: 0 };
      //       }
      //     );
      //     function orderValue(p) {
      //       return p.count;
      //     }
      //     communities = groupCommunities.order(orderValue).top(3);
      //     var monsterTable = dc.dataTable("#dc-monster-graph");
      //     monsterTable.width(800).height(800)
      //       .dimension(groupCommunities)
      //       .group(function(d) { return ""})
      //       .size(10)
      //       .columns([
      //       function(d) { return d.value.id },
      //       function(d) { return d.value.count },
      //       function(d) { return parseFloat(d.value.speed_avg).toFixed(2) },
      //       function(d) { return parseFloat(d.value.speed_avg).toFixed(2) },
      //       function(d) { return d.value.stops_count },
      //       function(d) { return '<svg><g class="node" transform="translate(10,10)" style="fill:'+colorScales["com_id"](d.value.id)+'"><circle r="5"></circle>/g></svg>' }
      //       ])
      //       .sortBy(orderValue)
      //       .order(d3.ascending);
      //     // dc.renderAll();
      //     monsterTable.render();
      //     updateMonsterCommunity()  
      //   }
        }
      }
      function updateMonsterCommunity() {
        // var monsterCommunityId = communities[0].value.id  
        // var monsterCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==monsterCommunityId ? d : null });
        //   vis.selectAll('.node').classed('monster-community',false); 
        //   if ($('#trackMonsterToggle').prop('checked')) {
        //     monsterCommunityNodes.classed('monster-community',true); 
        //   }
        var monsterCommunityId = d3.max(communities[step].values, function(d) { return d.count}).com_id 
        var monsterCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==monsterCommunityId ? d : null });
          vis.selectAll('.node').classed('monster-community',false); 
          if ($('#trackMonsterToggle').prop('checked')) {
            monsterCommunityNodes.classed('monster-community',true); 
          }
      }
      function createstaticTooltips(){      
        // vehicle info 
        var staticToltipType = "vehicle"
        var staticTooltip = d3.select("#staticTooltips").append('div').attr('class', 'staticTooltip '+staticToltipType);
        var titlebar = staticTooltip.append('div').attr('class','title');
        $(".staticTooltip").draggable({handle: ".title"}); 
        titlebar.append('span').attr('class', "text-info").html("<strong>Vehicle info</strong>")
        titlebar.append('button').attr('type', "button").attr('class', "close").text('x')
        var desc = staticTooltip.append('div').attr('class', 'body')
        desc.append('p').attr('class', 'main').text("Click on a dot to track a vehicle")
        desc.append('p').attr('class', 'id')
        desc.append('p').attr('class','degree')
        desc.append('p').attr('class', 'com_id')
        desc.append('p').attr('class','com_size')
        desc.append('p').attr('class','position')
        desc.append('p').attr('class','speed')
        desc.append('p').attr('class','link')
        desc.append('p').attr('class','num_stops')
        desc.append('p').attr('class','originator')
        staticTooltip.append('div').attr('class', 'bg');
        staticTooltips[staticToltipType] = staticTooltip;
        d3.selectAll('.staticTooltip.vehicle .close').on('click', function(e) {
          var sel = d3.select(this);
          if (sel.attr('class') === "close") {
            var parent  = $(sel[0]).parent().parent();
            if (parent) { parent.hide(); }
            if (trackedNode) { 
              trackedNode.classed('selected',false); 
              trackedNode = null;
            }
          }
        });

        // community info 
        var staticToltipType = "community"
        var staticTooltip = d3.select("#staticTooltips").append('div').attr('class', 'staticTooltip '+staticToltipType);
        var titlebar = staticTooltip.append('div').attr('class','title');
        $(".staticTooltip").draggable({handle: ".title"}); 
        titlebar.append('span').attr('class', "text-info").html("<strong>Community info</strong>")
        titlebar.append('button').attr('type', "button").attr('class', "close").text('x')
        var desc = staticTooltip.append('div').attr('class', 'body')
        desc.append('p').attr('class', 'main').text("Click on a dot to track a community")
        desc.append('p').attr('class', 'id')
        desc.append('p').attr('class','com_size')
        desc.append('p').attr('class','speed_avg')
        desc.append('p').attr('class','speed_std')
        desc.append('p').attr('class','avg_speed_avg')
        desc.append('p').attr('class','avg_speed_std')
        desc.append('p').attr('class','area')
        desc.append('p').attr('class','num_stops')
        desc.append('p').attr('class','congested_sum')
        staticTooltip.append('div').attr('class', 'bg');
        staticTooltips[staticToltipType] = staticTooltip;
        d3.selectAll('.staticTooltip.community .close').on('click', function(e) {
          var sel = d3.select(this);
          if (sel.attr('class') === "close") {
            var parent  = $(sel[0]).parent().parent();
            if (parent) { parent.hide(); }
          }
          if (trackedCommunityId) { 
              var trackedCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==trackedCommunityId  ? d : null });
              trackedCommunityNodes.classed('in-community',false); 
              trackedCommunityId = null;
            }
        });
      }

      function updatestaticTooltips(step) {
        var staticTooltip = staticTooltips["vehicle"];
        if (trackedNode && trackedNode.data() && trackedNode.data().length > 0) {
          // find node's data for the current step
          vis.selectAll('.node').classed('selected',false)
          trackedNode = vis.selectAll('.node').filter(function(d, i) { return d['id']==trackedNode.data()[0]['id']  ? d : null });
          trackedNode.classed('selected',true)
          d = trackedNode.data()[0];
          if (d) {
            staticTooltip.select('rect').transition().attr({ width: 250, height: 330, rx: 5, ry: 5, class: 'bg' })
            staticTooltip.select('.main').text("Step: " + (d.step+stepsOffset))
            staticTooltip.select('.id').text('Id: ' + d.node_id)
            staticTooltip.select('.degree').text('Degree: ' + d.degree)
            staticTooltip.select('.com_id').text('Community id: ' + d.com_id)
            staticTooltip.select('.com_size').text('Community size: ' + d.com_size)
            staticTooltip.select('.position').text('x: ' + parseFloat(d.x).toFixed(2) + ", y: " + parseFloat(d.y).toFixed(2))
            staticTooltip.select('.speed').text('Speed: ' + parseFloat(d.speed).toFixed(2))
            if (d.avg_speed !== undefined) {
              staticTooltip.select('.speed').text('Speed: ' + parseFloat(d.speed).toFixed(2) + ", avg speed: " + parseFloat(d.avg_speed).toFixed(2))
            }
            staticTooltip.select('.link').text('Link: ' + d.link_id)
            staticTooltip.select('.num_stops').text('Number of stops on link: ' + d.num_stops)
            staticTooltip.select('.originator').text('Is originator: ' + d.is_originator)
          }
        }

        var staticTooltip = staticTooltips["community"];
        if (trackedCommunityId) {
          // find node's data for the current step
          vis.selectAll('.node').classed('in-community',false)
          var trackedCommunityVehicles = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==trackedCommunityId ? d : null });
          trackedCommunityVehicles.classed('in-community',true)
          var avgSpeed = 0; // todo calculate from all nodes in tracked community - or crossfilter
          var sumNumStops = 0; // todo calculate from all nodes in tracked community - or crossfilter
          var radius = 0; // todo calculate from all nodes in tracked community - or crossfilter
          
          // trackedCommunity = trackedCommunityVehicles[0][0]
          if (trackedCommunityVehicles.data().length > 0) {
            var d = trackedCommunityVehicles.data()[0];
            if (d) {
              staticTooltip.select('rect').transition().attr({ width: 250, height: 300, rx: 5, ry: 5, class: 'bg' })
              staticTooltip.select('.main').text("Step: " + (d.step+stepsOffset))
              staticTooltip.select('.id').text('Id: ' + d.com_id)
              staticTooltip.select('.com_size').text('Community size: ' + d.com_size)
            }
            trackedCommunityId = d.com_id;
            var stepCommunities = communities[step].values;
            if (stepCommunities.length > 0) {
              var com = stepCommunities.filter(function(c, i) { return c.com_id == trackedCommunityId; })[0];
              staticTooltip.select('.speed_avg').text('Average speed: ' + parseFloat(com["speed_avg"]).toFixed(2))
              staticTooltip.select('.speed_std').text('Std speed: ' + parseFloat(com["speed_std"]).toFixed(2))
              staticTooltip.select('.avg_speed_avg').text('Community average speed: ' + parseFloat(com["avg_speed_avg"]).toFixed(2))
              staticTooltip.select('.avg_speed_std').text('Community std average speed: ' + parseFloat(com["avg_speed_std"]).toFixed(2))
              staticTooltip.select('.area').text('area radius: ' + parseFloat(com.range).toFixed(2))
              staticTooltip.select('.num_stops_sum').text('Number of stops: ' + com.num_stops_sum)
              staticTooltip.select('.congested_sum').text('Number of congestions: ' + com.congested_sum)
            }
          }
          else {
            trackedCommunityId = null;
          }
        } 
      }
      function posTooltip(d) {
        var   posX = d.fisheye ? d.fisheye.x : xScale(d.x)
            , posY = maxY-d.y
            , posY = d.fisheye ? d.fisheye.y : yScale(posY)
            , text = "size by : " + sortMetric +  ", color by : " + colorMetric
        
        tooltip.select('.main').text(text)
        tooltip.select('.id').text('Vehicle: ' + d.id)
        tooltip.select('.degree').text('Degree: ' + d.degree)
        tooltip.select('.com_id').text('Com_id: ' + d.com_id)
        tooltip.select('.com_size').text('Com size: ' + d.com_size)
        tooltip.select('.position').text('position: ' + posX + ' ' + posY)
        var box = tooltip.select('.desc').node().getBBox()
        box.x -= 10, box.y -= 10, box.width += 20, box.height += 20
        tooltip.select('rect').attr(box)
        var offset = d.fisheye? radius(d) * d.fisheye.z : radius(d);
        if( posX > width / 2 ) posX -= box.width + offset; else posX+= offset
        if( posY > height / 2 ) posY -= box.height + offset; else posY+= offset
        if (!$('.tooltip').hasClass('static')) {
          tooltip
            .attr('x',0)
            .attr('y',0)   
            .attr('transform', 'translate(' + posX + ',' + posY + ')')
            // .attr('transform', 'translate(' + 30 + ',' + 120 + ')')
        }
      }

      function updatePos(node){
        node
          .attr('transform', function(d){  
            // if (algorithm.indexOf("Kirchberg") != -1) {
            //   return 'translate(' + xScale(d.x) + ',' + yScale(d.y) + ')'
            // }
            return 'translate(' + xScale(d.x) + ',' + (yScale(maxY) - yScale(d.y)) + ')'
          })
        node.select('circle').attr('r', radius)
        return node
      }
      function updateColor(node){
        node.style('fill', function(d) { 
          if (colorMetric === "num_stops") {
            return colorScales["com_id"](d["com_id"]) 
          }
          return colorScales[colorMetric](d[colorMetric]) 
        })
        node.style('stroke', function(d) { 
          return colorScales[colorMetric](d[colorMetric]) 
        })
        node.select('circle').style("opacity", function(d) { 
          if (colorMetric == "num_stops" && d[colorMetric] >= 2) {
            return 1
          }
          return 0.5
        })
        node.style("stoke-opacity", 1);
        node.style('stroke-width', function(d) { 
          if (colorMetric == "num_stops") {
            if (d.isOrginator === 1) {
              return 7;
            }
            if (d[colorMetric] >= 2) {
              return 5;
            }
            else {
              return 0;
            }
          }
          return 2;
        })
      }
      function setFisheyePos(node){
        if (node && node.select('circle') && node.select('circle').length > 0) {
          node
            .attr('transform', function(d){    
              return 'translate(' +  d.fisheye.x + ' , ' +  d.fisheye.y + ')';
            })
          // node.select('circle')
          //   .attr('r', function(d){
          //     var z = d.fisheye && d.fisheye.z || 1
          //     if (z > 1 ) { 
          //       z *= 2
          //     }
          //     return radius(d) * z;
          //   })
            
          // node.attr('transform', function(d, i){
          //   return 'translate(' + d.fisheye.x + ', ' + d.fisheye.y + ')'
          // })
          node.select('circle').attr('transform', function(d){
            var z = d.fisheye && d.fisheye.z || 1
            return 'scale(' + z + ')'
          })
          return node
        }
      }
      function randomize(node){
        node.each(function(d){
          d.x = Math.random() * width
          d.y = Math.random() * height
        })
      }
      $('.sort-by').on('change', function(){
        var newMetric = $(this).val()
        if (sortMetric === newMetric) return
        sortMetric = newMetric
        updateAreaScale(sortMetric)
        node.transition().duration(1000).call(updatePos)
      })
      $('.color-by').on('change', function(){
        var newMetric = $(this).val()
        if (colorMetric === newMetric) return
        colorMetric = newMetric 
        updateColorScale(colorMetric)
        d3.selectAll('.vis .node').transition().duration(1000).call(updateColor)
      })
      $(window).resize(function(){
        // width = window.innerWidth
        // height = window.innerHeight
        width =  parseInt(d3.select(".vis-column").style("width"));
        height = width * areaRatio;
        node.call(updatePos)
        updateMaxArea(areaRatio)
        node.select('circle').attr('r', radius)
      })
      function fisheyeEffect(vis){
        return vis.on('mouseover', function(d){
          var m = d3.mouse(this);
          // var circle = d3.select(this);
          if(!node) return
          d3.select('.tooltip').style('display', 'inherit')
        }).on("mousemove", function(d){
          if (!d) {
            var d = d3.select(this).select('circle').datum();
          }
          if (fisheye) {
            var m = d3.mouse(this)
            fisheye.focus(m)
            if (!node) return
            node.each(function(d, i){
              var prev_z = d.fisheye && d.fisheye.z || 1
              scaledD = {x: xScale(d.x), y: (yScale(maxY) - yScale(d.y)), z: 1}
              // if (algorithm.indexOf("Kirchberg") != -1) {
              //   scaledD = {x: xScale(d.x), y: yScale(d.y), z: 1}
              // }
              d.fisheye = fisheye(scaledD)
              d.fisheye.prev_z = prev_z
            })
            .filter(function(d){ return d.fisheye.z !== d.fisheye.prev_z })
            // .sort(function(a, b){ return a.fisheye.z > b.fisheye.z ? 1 : -1 })
            .call(setFisheyePos)
            .call(function(node){
              var max, maxNode
              node.each(function(d){
                if( !max || d.fisheye.z > max.fisheye.z) { max = d; maxNode = this }
              })
              var scaledD = {x: xScale(d.x), y: (yScale(maxY) - yScale(d.y)), z: 1}
              // if (algorithm.indexOf("Kirchberg") != -1) {
              //   scaledD = {x: xScale(d.x), y: yScale(d.y), z: 1}
              // } 
              if(topNode !== maxNode) updateTopNode(maxNode)
            })
          }
        }).on('mouseleave', function(d){
          d3.select('.tooltip').style('display', 'none')
          node.each(function(d, i){ 
            var yy = yScale(maxY) - yScale(d.y);
            // if (algorithm.indexOf("Kirchberg") != -1) {
            //   yy = d.y;
            // }
            d.fisheye = {x: xScale(d.x), y: yy, z: 1} 
          })
          .filter(function(d){ return d.fisheye.z !== d.fisheye.prev_z })
          .call(setFisheyePos)
        })
      }
      function updateMaxArea(areaRatio){
        area = calcBestArea(areaRatio)
        max_area = area.r
        areaScale.range([0, area.r])
        xScale.range([margin, area.width - margin])
        h = area.height;
        yScale.range([margin_top, h])
      }
      function updateTopNode(maxNode){
        if (!maxNode) return;
        if(topNode) topNode.classed('active', false)
        topNode = d3.select(maxNode).classed('active', true)
      }

      $(document).keypress(function(e){
        if ((e.which && e.which == 32) || (e.keyCode && e.keyCode == 32)) {
          togglePlay();
          if (timer) {
            pause();
          }
          else {
            play();
          }
          return false;
        } else {
          return true;
        }
      });
      $('.playbutton').click(function(){
        togglePlay();
        if ($(this).hasClass("play")) {
          $(this).addClass("pause");
          $(this).removeClass("play");
          play();
        }
        else {
          $(this).addClass("play");
          $(this).removeClass("pause");
          pause();
        }
        return false;
      }); 
      function togglePlay(){
        var $elem = $('.player').children(':first');
        $elem.stop()
          .show()
          .animate({'marginTop':'-175px','marginLeft':'-175px','width':'350px','height':'350px','opacity':'0'},function(){
            $(this).css({'width':'100px','height':'100px','margin-left':'-50px','margin-top':'-50px','opacity':'1','display':'none'});
          });
        $elem.parent().append($elem);
      }
      function play() {
        if (step*stepSize < lastStep) {
          step += 1;
        }
        else {
          step = firstStep/stepSize;
        }
        onStepUpdated();
        slider.slider({value :step });
        timer = setTimeout(function() {  
            play();
          }, timerDelay);
      }
      function pause() {
        if (timer) {
          clearTimeout(timer);
          timer = 0
        }
      }
    }