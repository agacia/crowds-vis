window.onload = function() {
  var 
        width = parseInt(d3.select(".vis-column").style("width")),
        height = areaRatio * width
        // , height = parseInt(d3.select("#visualisation").style("height"))
        // width = window.innerWidth
        // , height = window .innerHeight
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
            // d3.select('.vis').style({ width: w + 'px', height: (h+toolbar_height) + 'px' })
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
          "speed": d3.scale.linear().range(["red","green"]),
          "num_stops": d3.scale.linear().range(["green","red"])}
        , colorMetric = 'com_id'
        , sortMetric = $('.sort-by').val()
        , colorMetric = $('.color-by').val()
        , algorithm = $('.algorithm-select').val()
        , firstStep = 0, step = 0, lastStep = 0, stepSize = 0
        , id = 0, order = 0
        , radius = function(d) { 
            var metric = sortMetric
            var scale = 1
            if (metric == "cos_score" || metric == "com_size") {
              scale = 0.4;
              if (d[metric] < 0) {
                 return areaToRadius(0.1, scale)
              }
            }
            return areaToRadius(areaScale(d[metric]), scale) 
          }
        , dataKey = function(d){ return d.node_id }
        , sortBy = function(by){ return function(a, b){ 
            if(a[by] === b[by]) return 0; else if(a[by] > b[by]) return -1;
            return 1;
        }}
        , projection = d3.geo.albers()
        , money = d3.format('$,04d')   
        , format = function(d){ // when read cvs
            // step  id x y degree  neighbors cc_id cc_size com_id  cos_score com_size
            var numKeys = ['step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            d.id = id++;
            d.order = order++;
            return d;
        }
        , formatGroup = function(d){ // when read cvs
            // step id  x y degree  com_id  cos_score com_size  cc_size metadata  color
            var numKeys = ['step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            d.order = order++;
            return d;
        }
        , topNode = null
        , filename ='groups_'
        , imgUrl = 'http://vehilux.gforge.uni.lu/files/crowds-images/algorithms/'
        , rootUrl = 'data/'
        // , scenario = $('.scenario-select').val()
        , scenario = "Manhattan"
        , slider = $( ".slider" ).slider({
            min: firstStep,
            max: lastStep,
            step: stepSize,
            value: firstStep,
            slide: function( event, ui ) { 
              step = ui.value; 
              onStepUpdated()
            }
          })
        , dateLabel = $("<div/>")
                    .css({ position : 'absolute' , top : 0, left : 0 })
                    .text(step)
        , vehicles = {}
        , dataLoaded = 0
        , timer
        , timerDelay = 300
        , trackedNode = 0
        , staticTooltip

      $(".slider").slider()
        .find(".ui-slider-handle")
        .append(dateLabel)

      if ( window.self !== window.top ){
        // we're in an iframe! oh no! hide the twitter follow button
      }

      loadFiles(rootUrl, scenario, algorithm, filename);
      loadFile(rootUrl + scenario + "/" + algorithm + "/communities.csv");
     
      vis.call(createStaticTooltip);
      vis.call(createTooltip)   
      
      function onStepUpdated() {
        showVehicles(vehicles[step])
        dateLabel.text(step)        
        updateStaticTooltip(step);
      }
      function setScenario(scenario) {
        step = 0
        firstStep = 0;
        lastStep = 600;
        stepSize = 2;
        timerDelay = 100;
        margin = 10;
        margin_top = 20;
        margin_bottom = 20;
        areaRatio = 1;
        if (scenario == "Highway" || scenario=="Split") {
          areaRatio = 0.25;
        }
        if (scenario == "Box" || scenario=="Cross" || scenario=="Manhattan") {
          areaRatio = 1;
        }
        if (scenario == "Luxembourg") {
          firstStep = 0;
          lastStep = 1200;
          stepSize = 10;
          timerDelay = 300;
          areaRatio = 0.85;
        }
        slider.slider({
            min: firstStep,
            max: lastStep,
            step: stepSize,
            value: firstStep,
            slide: function( event, ui ) { 
              step = ui.value; 
              onStepUpdated()
            }});
        updateMaxArea(areaRatio);
      }
      function loadFiles(rootUrl, scenario, algorithm, baseFilename){
        $('#loader1').show()
        vehicles = {};
        dataLoaded = 0;
        vis.selectAll('.node').remove()
        setScenario(scenario);
        for (var i = firstStep; i < lastStep; i += stepSize) {
          var reqUrl = rootUrl + scenario + "/" + algorithm + "/groups/" + baseFilename + ("0000" + i).slice(-4) + ".tsv"
          // 'data/MobileLeung/communities.tsv'
          d3.tsv(reqUrl, formatGroup, function(err, rows){
            dataLoaded += 1
            if (dataLoaded == lastStep/stepSize) {
              $('#loader1').hide()
            }
            if(err) {
              $('.error').html("No data for " + scenario + " with algorithm " + algorithm);
              // throw err
            }
            else {
              if (rows.length > 0) {
                var stepId = rows[0].step
                vehicles[stepId] = rows
              }
              gotVehicles(stepId);
            }
          })
        }
      }

      function loadFile(url) {
        $('#loader2').show()
        d3.tsv(url, format, function(err, data){
          if(err) {
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm + " " + url);
          }
          else {
            $('#loader2').hide();
            $('.error').html("");
            d3.select(".data-status").html("Analysing " + data.length + " rows of data...")
            // console.log("loaded ", url, data)
            var cf = crossfilter(data);
            drawVehicleCharts(cf);
            d3.select(".charts-status").html("Drawing time series...")
            drawTimeseriesCharts(cf);
          }
        })
      }
      function drawVehicleCharts(cf) {
        var vehicleDimension = cf.dimension(function(d) {
          d.speed = +d.speed;
          d.num_stops = +d.num_stops;
          return +d.node_id;
        })
        var vehicleGroup = vehicleDimension.group().reduceCount();
        var vehicles = vehicleGroup.all();
        var sum = 0;
        for (var vehicle in vehicles) {
          sum += vehicles[vehicle].value
        }
        var average = (sum / vehicles.length).toFixed(2);
        var stdDeviation = 0
        for (var vehicle in vehicles) {
          deviation = Math.pow(vehicles[vehicle].value - average, 2)
          stdDeviation += deviation;
        }
        stdDeviation = Math.sqrt(stdDeviation / vehicles.length).toFixed(2)
        // vehicleGroup.all().reduce(function(previousValue, currentValue) { return previousValue.sum + previousValue. });
        // console.log("vehicleGroup", vehicleGroup.all(), "sum", sum, "avg", average)
        d3.select("#stats").append("div").html("Total number of vehicles: " + vehicles.length);
        d3.select("#stats").append("div").html("Average seconds traveled: " + average);
        d3.select("#stats").append("div").html("Standard deviation: " + stdDeviation);
        d3.select("#stats").append("div").html("Total seconds traveled: " + sum);

        var cf2 = crossfilter(vehicles)
        var hist = cf2.dimension(function(d) { return d.value})
        var count = hist.group();

        // console.log("count ", count.all())
        var numBins = 30;
        var binWidth = (count.all().length) / numBins;
        // console.log("binWidth", binWidth)
        var count = hist.group(function(d) {return Math.floor(d / binWidth) * binWidth;});
        console.log("count ", count.all())
        drawHistogram("#hist-vehicles", "Trip duration", "Number of vehicles", hist, count, numBins, binWidth)
            
        d3.select(".data-status").style("display", "none")
      } 
      function drawTimeseriesCharts(cf) {
            var timeDimension = cf.dimension(function(d) {
              d.speed = +d.speed;
              d.num_stops = +d.num_stops;
              return +d.step;
            })
            var metric = "num_stops";
            var groupSize = 1;
            // function(step) { return Math.floor(step / 10); }
            // var timeGroup = timeDimension.group(function(step) { return Math.floor(step / groupSize); }).reduce(
            var timeGroup = timeDimension.group().reduce(
              function(p,v) { // add
                ++p.count;
                if (v.num_stops > 1) {
                  ++p.stops_count
                }
                p.speed_sum += v.speed
                p.speed_avg = p.speed_sum / p.count;
            
                return p;
              },
              function(p,v) { // remove
                --p.count;
                if (v[metric] > 0) {
                  --p.stops_count
                }
                p.speed_sum -= v.speed_sum;
                p.speed_avg = p.speed_sum / p.count;
                return p;
              },
              function() { // init
                return { count: 0, speed_sum: 0, speed_avg: 0, stops_count: 0 };
              }
            )

            drawChart("#num-vehicles", "Step", "Number of vehicles", timeDimension, timeGroup, "step", "count", groupSize)
            drawChart("#num-stops", "Step", "Number of congestion reports", timeDimension, timeGroup, "step", "stops_count", groupSize)
            
      }
      function drawHistogram(selection, xLabel, yLabel, dimension, group, nBins, binWidth) {
        
        // var xMax = dimension.bottom(1)[0].key
        // var xMin = dimension.top(1)[0].key;
        counts = group.all();
        var xMin = counts[0].key
        var xMax = counts[counts.length-1].key;
        // var xMin = 0;
        // var xMax = nBins;
        var chart = dc.barChart(selection);
        chart
          // .width(580)
          .height(160)
          .x(d3.scale.linear().domain([xMin,xMax]))
          // .interpolate('step-before')
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

      function drawChart(selection, xLabel, yLabel, dimension, group, keyAccessor, valueAccessor, groupSize) {
        var xMin = dimension.bottom(1)[0][keyAccessor]
        var xMax = dimension.top(1)[0][keyAccessor];
            
        var chart = dc.lineChart(selection);
        chart
          // .width(580)
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

      function gotVehicles(){
        if (dataLoaded == lastStep/stepSize) {
          $('.error').html("");
          updateXScale("x");
          updateYScale("y");
          step = firstStep;
          showVehicles(vehicles[step])
          // fisheyeEffect(vis)
        }
      }
      function showVehicles(vehicles) { 
        // console.log("showing step ", step, vehicles)  
        updateAreaScale(sortMetric)
        var exitNodes = vis.selectAll('.node').data(vehicles, dataKey).exit()
        // console.log("step", step, " exit nodes ", exitNodes)
        exitNodes
          // .transition().duration(900).style("opacity",0)
          .remove();
        node = vis.selectAll('.node').data(vehicles)
          .enter()
            .append('g')
            .attr('class', 'node')  
        // console.log("step", step, " nodes ", node)
        node.on('click', function(){
          console.log("node clicked")
          var node // = d3.select('.node.highlighted').classed('highlighted', false).node()
            , sel = d3.select(this)
          
          if(sel.node() !== node) sel.classed('selected', !d3.select(this).classed('selected'))
          var startTracking = d3.select(this).classed('selected')
          if (startTracking) {
            d3.select('.staticTooltip').style('display', 'block')
            trackedNode = sel
            updateStaticTooltip(step);
          }
          else {
            trackedNode = 0
            d3.select('.staticTooltip').style('display', 'none')
          }
        })
        node.append('circle')
          .call(updateColor)
        node.call(updatePos) 
          // .call(tooltipEffect);
        fisheyeEffect(vis)
      }
      
      function updateXScale(metric) {
        maxX = 0;
        for (var i = firstStep; i < lastStep; i += stepSize)  {
           maxXStep = d3.max(vehicles[i], function(d){ return d[metric] })
           if (maxXStep > maxX) {
            maxX = maxXStep;
           }
        }
        xScale.domain([0, maxX])
      }
      function updateYScale(metric) {
        // y range 9717.82 - 37499.01 
        maxY = 0;
        for (var i = firstStep; i < lastStep; i += stepSize)  {
           maxYStep = d3.max(vehicles[i], function(d){ return d[metric] })
           if (maxYStep > maxY) {
            maxY = maxYStep;
           }
        }
        yScale.domain([0, maxY])
      }
      function updateAreaScale(metric){
        areaScale.domain([0, d3.max(vehicles[step],function(d){ return d[metric] }) ])
      }
      function updateColorScale(metric){
        for (var i in colorScales) {
          colorScales[i].domain([0, d3.max(vehicles[step],function(d){ return d[metric] }) ])
        }
      }
      function createTooltip(vis){
        d3.select('.tooltip').remove();
        tooltip = vis.append('g').attr('class', 'tooltip')
        tooltip.append('rect').attr({ width: 130, height: 200, rx: 5, ry: 5, class: 'bg' })
        var desc = tooltip.append('g').attr('class', 'desc')
        desc.append('text').attr('class', 'main').text('').attr('transform', 'translate(5,5)')
        desc.append('text').attr('class', 'id').text('Vehicle: ').attr('transform', 'translate(5,25)')
        desc.append('text').attr('class','degree').text('Degree: ').attr('transform', 'translate(5,45)')
        desc.append('text').attr('class', 'com_id').text('Community id: ').attr('transform', 'translate(5,65)')
        desc.append('text').attr('class','com_size').text('Community size: ').attr('transform', 'translate(5,85)')
        desc.append('text').attr('class','speed').text('Speed: ').attr('transform', 'translate(5,105)')
        desc.append('text').attr('class','link').text('Link: ').attr('transform', 'translate(5,125)')
        desc.append('text').attr('class','num_stops').text('Nu,ber of stops on link').attr('transform', 'translate(5,145)')
        // desc.append('text').attr('class','position').text('position: ').attr('transform', 'translate(5,105)')
        return tooltip
      }
      function createStaticTooltip(vis){
        // d3.select('.staticTooltip').remove();
        // console.log("pos", max_area)
        staticTooltip = d3.select("#staticTooltip").append('svg').append('g').attr('class', 'staticTooltip')
            .attr('x',0)
            .attr('y',0)   
            .attr('transform', 'translate(' + 30 + ',' + 60 + ')')
        staticTooltip.append('rect').attr({ width: 240, height: 240, rx: 5, ry: 5, class: 'bg' })
        var desc = staticTooltip.append('g').attr('class', 'desc')
        desc.append('text').attr('class', 'main').text("Click on a dot to track a vehicle").attr('transform', 'translate(5,15)')
        desc.append('text').attr('class', 'id').attr('transform', 'translate(5,35)')
        desc.append('text').attr('class','degree').attr('transform', 'translate(5,55)')
        desc.append('text').attr('class', 'com_id').attr('transform', 'translate(5,75)')
        desc.append('text').attr('class','com_size').attr('transform', 'translate(5,95)')
        desc.append('text').attr('class','position').attr('transform', 'translate(5,115)')
        desc.append('text').attr('class','speed').attr('transform', 'translate(5,135)')
        desc.append('text').attr('class','link').attr('transform', 'translate(5,155)')
        desc.append('text').attr('class','num_stops').attr('transform', 'translate(5,175)')
        return staticTooltip
      }
      function updateStaticTooltip(step) {
        if (trackedNode && trackedNode.data() && trackedNode.data().length > 0) {
          // find node's data for the current step
          vis.selectAll('.node').classed('selected',false)
          trackedNode = vis.selectAll('.node').filter(function(d, i) { return d['id']==trackedNode.data()[0]['id']  ? d : null });
          trackedNode.classed('selected',true)
          d = trackedNode.data()[0];
          if (d) {
            staticTooltip.select('rect').transition().attr({ width: 250, height: 300, rx: 5, ry: 5, class: 'bg' })
            staticTooltip.select('.main').text("Tracked vehicle:")
            staticTooltip.select('.id').text('Vehicle: ' + d.id)
            staticTooltip.select('.degree').text('Degree: ' + d.degree)
            staticTooltip.select('.com_id').text('Com_id: ' + d.com_id)
            staticTooltip.select('.com_size').text('Com size: ' + d.com_size)
            staticTooltip.select('.position').text('x: ' + parseFloat(d.x).toFixed(2) + ", y: " + parseFloat(d.y).toFixed(2))
            staticTooltip.select('.speed').text('Speed: ' + parseFloat(d.speed).toFixed(2))
            staticTooltip.select('.link').text('Link: ' + "NA")
            staticTooltip.select('.num_stops').text('Number of stops on link: ' + d.num_stops)
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
            return 'translate(' + xScale(d.x) + ',' + yScale(maxY - d.y) + ')'
          })
        node.select('circle').attr('r', radius)
        return node
      }
      function updateColor(node){
        node.style('fill', function(d) { 
          return colorScales[colorMetric](d[colorMetric]) 
        })
        node.style("fill-opacity", .8)
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
        if (sortMetric === newMetric) return
        colorMetric = newMetric
        updateColorScale(colorMetric)
        node.transition().duration(1000).call(updateColor)
      })
      $('.algorithm-select').on('change', function(){
        var newAlgorithm = $(this).val()
        if (algorithm === newAlgorithm) return
        algorithm = newAlgorithm
        loadFiles(rootUrl, scenario, algorithm, filename);
      })
      $('.scenario-select').on('change', function(){
        var newScenario = $(this).val()
        if (scenario === newScenario) return
        scenario = newScenario
        loadFiles(rootUrl, scenario, algorithm, filename);
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
      function tooltipEffect(vis) {
        return vis.on('mouseover', function(d) {
            d3.select('.tooltip').style('display', 'inherit')
            sel = d3.select(this)
            if(sel.node() !== node) sel.classed('highlighted', true)
            // sel.select('circle').attr('transform', 'scale(' + 2 + ')')
            posTooltip(d)
          })
          .on('mouseleave', function hideTooltip(d) {
            d3.select('.tooltip').style('display', 'none')
            if(sel.node() !== node) sel.classed('highlighted', false)
            // sel.select('circle').attr('transform', 'scale(' + 0.5 + ')')
        })  
      }
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
              scaledD = {x: xScale(d.x), y: yScale(maxY - d.y), z: 1}
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
              var scaledD = {x: xScale(d.x), y: yScale(maxY - d.y), z: 1}
              if(topNode !== maxNode) updateTopNode(maxNode)
            })
          }
        }).on('mouseleave', function(d){
          d3.select('.tooltip').style('display', 'none')
          node.each(function(d, i){ d.fisheye = {x: xScale(d.x), y: yScale(maxY - d.y), z: 1} })
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
        posTooltip(topNode.datum())
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
        step += stepSize;
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