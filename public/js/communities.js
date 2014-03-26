window.onload = function() {
  var 
      width = parseInt(d3.select(".vis-column").style("width"))
      , height = width
      // , sketch = d3.select("body #visualisation").append("div").attr('class','circle-container')
      // , sketch = d3.select("body #visualisation").append("custom:sketch")
      //   .attr("width", width)
      //   .attr("height", height)
      //   .style({ width: width+ 'px', height: height+ 'px'})
      , canvas = d3.select("body #visualisation")
          .attr("width", width)
          .attr("height", height)
          .append('canvas').node()
      
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
        "dynamism": d3.scale.linear().range(["red","yellow","green"]),
        "speed": d3.scale.linear().range(["red","yellow","green"]),
        "avg_speed_avg": d3.scale.linear().range(["red","yellow","green"]),
        "avg_speed_std": d3.scale.linear().range(["red","yellow","green"]),
        "num_stops": d3.scale.linear().range(["green","yellow","#FF530D"]),
        "congested_sum": d3.scale.linear().range(["green","yellow","red"])}
      , colorMetric = 'com_id'
      , sortMetric = $('.sort-by').val()
      , colorMetric = $('.color-by').val()
      , algorithm = $('.algorithm-select').val()
      , firstStep = 0, step = 0, lastStep = 0, stepSize = 0
      , id = 0, order = 0
      , radius = function(d) { 
          var metric = sortMetric
          if (metric === "None") {
            return 5;
          }
          var scale = 1;
          return areaToRadius(areaScale(d[metric]), scale) 
        }
      , dataKey = function(d){ return d.node_id }
      , format = function(d) { // when read cvs
          var numKeys = ['node_id', 'step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size', 'speed', 'num_stops', 'is_originator', 'dynamism'];
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
      , communities = {}
      , monsterSortMetric = "count"
      , tip = new InfoTooltip()
      // , stage, layers // kinetic

      if ( window.self !== window.top ){
        // we're in an iframe!
      }

      // Register the "custom" namespace prefix for our custom elements.
      d3.ns.prefix.custom = "http://github.com/mbostock/d3/examples/dom";

      init();
      createstaticTooltips(); 

      function init() {
        vehicles = {}
        communities = {}
        tip(".project-info")
        tip.show();
        pause()
        var context = canvas.getContext("2d");
        clear(context);
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
          margin_top = 5;
        }


      }
      function gotAllData(error, results) {
        console.log(error, results)
        tip.hide();
        gotCommunities(error, results[0]);
        gotVehicles(error, results[1]);
      }
      

      function loadFile(url, loader, cb) {
        // console.log("loading file ", url)
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
            cb(null, [])
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm + " " + url);
          })
          .get();
      }
      function gotCommunities(error, data) {

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
            com.avg_speed_avg = +d["avg_speed_mean"]
            com.avg_speed_min = +d["avg_speed_amin"]
            com.avg_speed_max = +d["avg_speed_amax"]
            com.avg_speed_std = +d["avg_speed_std"]
            com.num_stops_sum = +d["num_stops"]
            com.num_stops_avg = +d["num_stops_mean"]
            com.num_stops_min = +d["num_stops_amin"]
            com.num_stops_max = +d["num_stops_amax"]
            com.congested_sum = +d["congested"]
           }
           return com;
        })
        // console.log(data)
        communities= d3.nest()
          .key(function(d) { return d.step; })
          .entries(data);

        console.log("got communities", data)
        createMonsters(step);
      }

      function gotVehicles(error, data) {
        data.forEach(function(d){
          d.step = +d.step;
          d.avg_speed = +d.avg_speed
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
         
        canvas.style.position = "relative";
        var root = $('body #visualisation');
        canvas.width = width;
        canvas.height = height;
        
        console.log("communities", communities)
        if (communities.length > 0) {
          for (time in vehicles) {
            var stepCommunities = communities[time].values;
            vehicles[time].values.forEach(function(d) {
              var com = stepCommunities.filter(function(c) { return c.com_id == d.com_id})
              if (com.length > 0) {
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
        drawVehicles(canvas, step);
      }

      /* Test of kinetic performance - too slow */
      function testKinetic() {
        console.log("initKineticStage...")
        initKineticStage();
        console.log("drawVehiclesKinetic...")
        drawVehiclesKinetic(step);
      }

      function initKineticStage() {
        stage = new Kinetic.Stage({
          container: 'kinetic-container',
          width: width,
          height: height
        });
        layers = { 
          "circles": new Kinetic.Layer(),
          "tooltip" : new Kinetic.Layer()
        };

        var tooltip = new Kinetic.Text({
          text: "",
          fontFamily: "Calibri",
          fontSize: 12,
          padding: 5,
          visible: false,
          fill: "black",
          opacity: 0.75,
          textFill: "white"
        });
        layers['tooltip'].add(tooltip);
        stage.add(layers['tooltip']);
      }

      // function drawVehiclesKinetic(step) {
      //   var circlesLayer = layers['circles'];
      //   circlesLayer.destroy();
      //   var tooltipLayer = layers['tooltip'];
      //   var tooltip = tooltipLayer.children[0]
      //   for (v in vehicles[step]) {( function(st, lay) {
      //     var vehicle = vehicles[step][v];
      //     var x = xScale(vehicle.x);
      //     var y = yScale(vehicle.y);
      //     var color = colorScales[colorMetric](vehicle[colorMetric]) 
      //     var r = radius(vehicle)
      //     var circle = new Kinetic.Circle({
      //         x: x,
      //         y: y,
      //         radius: r,
      //         fill: color
      //       });
      //     circle.on("mousemove", function() {
      //         // update tooltip
      //         var mousePos = st.getPointerPosition();
      //         tooltip.setPosition(mousePos.x + 5, mousePos.y + 5);
      //         tooltip.setText("node: " + vehicle['node_id'] + ", community: " + vehicle['com_id'] + ", avg speed: " + vehicle['avg_speed']);
      //         tooltip.show();
      //         tooltipLayer.draw();
      //       });

      //       circle.on("mouseout", function() {
      //         tooltip.hide();
      //         tooltipLayer.draw();
      //       });

      //       circlesLayer.add(circle);
      //     })(stage, layers);
      //   }

      //   stage.add(layers['circles']);
      // }

      function drawVehicles(canvas, step) {
        var time = step;
        context = canvas.getContext("2d");
        clear(context);
        d3.selectAll(".custom-circle").remove();
        if (!(time in vehicles)) {
          return;
        }
        for (v in vehicles[time].values) {
          var vehicle = vehicles[time].values[v];
          var x = xScale(vehicle.x);
          var y = yScale(maxY - vehicle.y);
          var color = colorScales[colorMetric](vehicle[colorMetric]) 
          var r = radius(vehicle)
          // console.log("vehicle", vehicle, "r", r)
          // sketch.append("custom:circle")
          // sketch.append("div")
            // .attr('class', 'custom-circle')
            // .attr("x", x)
            // .attr("y", y)
            // .attr("radius", r)
            // .attr("strokeStyle", color)
            // .attr("fillStyle", color)
            // .style('top', x + 'px') // cant set style propety of custom objects
            // .style('left', y +'px')
            // .style('position', 'absolute')
            // .on('mousemove', function(e) { console.log("mousemove")})
          // .transition()
          //   .duration(2000)
          //   .ease(Math.sqrt)
          //   .attr("radius", 200)
          //   .attr("strokeStyle", "white")
          //   .remove();
          var circle = {x: x, y: y, r: r, strokeStyle: color, fillStyle: color};
          drawCircle(context, circle)
        }
        // Clear the canvas and then iterate over child elements.
        function redraw() {
          // clear(context);
          canvas.width = canvas.getAttribute("width");
          canvas.height = canvas.getAttribute("height");
          // for (var child = root.firstChild; child; child = child.nextSibling) draw(child);
          var circle = {x: 10, y: 10, r: 10, strokeStyle: "red"};
          draw(context, circle);
        }
      };

      function clear(ctx) {
        // ctx.beginPath();
        // ctx.clearRect(0, 0, width, height);
        // ctx.closePath();
        canvas.width = canvas.width;
      }

      // For now we only support circles with strokeStyle.
      // But you should imagine extending this to arbitrary shapes and groups!
      function drawCircle(context, element) {
        context.strokeStyle = element.strokeStyle;
        context.fillStyle = element.fillStyle;
        context.globalAlpha = 0.5;
        context.beginPath();
        context.arc(element.x, element.y, element.r, 0, 2 * Math.PI);
        context.stroke();
        context.fill();
      }
      
      function initialiseSlider(firstStep, lastStep, stepSize, callback) {
        console.log("initialiseSlider",firstStep, lastStep, stepSize)
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
        drawVehicles(canvas, step)
        dateLabel.text(formatStep(step))        
        createMonsters(step);
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
        } else if (vehicles && vehicles[step].values.length > 0) {
          areaScale.domain([0, d3.max(vehicles[step].values,function(d){ return d[metric] }) ])
        }
      }
      function updateColorScales(data) {
        d3.selectAll(".legend-item").remove();

        for (var metric in colorScales) {
          if (metric != "com_id") {
            var maxVal = d3.max(data, function(d){ return d[metric] })
            var minVal = d3.min(data, function(d){ return d[metric] })
            if (metric == "avg_speed") {
              colorScales[metric].domain([minVal, 25, maxVal])  
            }
            else if (metric == "dynamism") {
              colorScales[metric].domain([minVal, 0, maxVal])  
            }
            else {
              colorScales[metric].domain([minVal, (maxVal-minVal)/2, maxVal])
            }
            var colors = []
            var scaleLen = colorScales[metric].range().length;
            if (scaleLen < 9) {
              scaleLen = 9
            }
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
      function initialiseMonsterTracker() {
        // d3.select('.monsters.tracker .icon').append('svg').append('g').attr('class', 'node monster-community') 
        //       .attr('transform', 'translate(' + 10 + ',' + 8 + ')')
        //       .append('circle').attr('r', 5)
        // $("#trackMonsterToggle").prop('checked') ? $('.monsters.tracker .icon').show() : $('.monsters.tracker .icon').hide();
        // $("#trackMonsterToggle").on('click', function(d) {
        //   $("#trackMonsterToggle").prop('checked') ? $('.monsters.tracker .icon').show() : $('.monsters.tracker .icon').hide();
        //   updateMonsterCommunity()
        // });
        // d3.select('.originators.tracker .icon').append('svg').append('g').attr('class', 'node originator') 
        //       .attr('transform', 'translate(' + 10 + ',' + 8 + ')')
        //       .append('circle').attr('r', 5)
        // $("#showOriginatorsToggle").prop('checked') ? $('.originators.tracker .icon').show() : $('.originators.tracker .icon').hide();
        // $("#showOriginatorsToggle").on('click', function(d) {
        //   var trackOriginators = $("#showOriginatorsToggle").prop('checked') 
        //   if (trackOriginators) {
        //     $('.originators.tracker .icon').show() 
        //     vis.selectAll(".node").classed("originator", function(d) {
        //       return d.is_originator;
        //     })
        //   } 
        //   else {
        //     $('.originators.tracker .icon').hide();
        //     vis.selectAll(".node").classed("originator", false)
        //   }
        // });
        
      }
      function orderValue(p) {
        return p[monsterSortMetric];
      }

      function createMonsters(step, asc) {
        asc = asc || false;
        var time = step / stepSize;
        if (time in communities) {
          d3.select(".communities-stats")
            .select('.num-communities').text("Number of communities: " + communities[time].values.length)
          var cf = crossfilter(communities[time].values);
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
              function(d) { return parseFloat(d.avg_speed_avg).toFixed(2) },
              function(d) { return parseFloat(d.avg_speed_std).toFixed(2) },
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
          // updateMonsterCommunity();  
        }
      }
      function updateMonsterCommunity() {
        // var monsterCommunityId = communities[0].value.id  
        // var monsterCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==monsterCommunityId ? d : null });
        //   vis.selectAll('.node').classed('monster-community',false); 
        //   if ($('#trackMonsterToggle').prop('checked')) {
        //     monsterCommunityNodes.classed('monster-community',true); 
        //   }
        // var monsterCommunityId = communities[step].top(1)[0].com_id 
        // var monsterCommunityNodes = vis.selectAll('.node').filter(function(d, i) { return d['com_id']==monsterCommunityId ? d : null });
        //   vis.selectAll('.node').classed('monster-community',false); 
        //   if ($('#trackMonsterToggle').prop('checked')) {
        //     monsterCommunityNodes.classed('monster-community',true); 
        //   }
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

      function updatePos(node){
        node
          .attr('transform', function(d){  
            return 'translate(' + xScale(d.x) + ',' + yScale(maxY - d.y) + ')'
          })
        node.select('circle').attr('r', radius)
        return node
      }
     
      $('.sort-by').on('change', function(){
        var newMetric = $(this).val()
        if (sortMetric === newMetric) return
        sortMetric = newMetric
        updateAreaScale(sortMetric)
        drawVehicles(canvas, step)
        // node.transition().duration(1000).call(updatePos)
      })
      $('.color-by').on('change', function(){
        var newMetric = $(this).val()
        if (colorMetric === newMetric) return
        colorMetric = newMetric 
        drawVehicles(canvas, step)
      })
      $('.algorithm-select').on('change', function(){
        var newAlgorithm = $(this).val()
        if (algorithm === newAlgorithm) return
        algorithm = newAlgorithm;
        if (algorithm.indexOf("30012014") != -1) {
          stepsOffset = 1682;
        }
        init();  
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
      function updateMaxArea(areaRatio){
        area = calcBestArea(areaRatio)
        max_area = area.r
        areaScale.range([0, area.r])
        xScale.range([margin, area.width - margin])
        h = area.height;
        yScale.range([margin_top, h])
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