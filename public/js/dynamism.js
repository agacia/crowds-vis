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
      , stepsOffset = 841
      , formatStep = function(step) {
        var seconds = step*2 + stepsOffset
        if ((lastStep - firstStep) > 120) {
         return (seconds/60).toFixed(2) + " min"
        }
        return seconds + " s"
      }
      , topNode = null
      , rootUrl = 'data/'
      , scenario = "Manhattan"
      , slider
      , dateLabel = $("<div/>")
                  .css({ position : 'absolute' , top : 0, left : 0, width: "60px"})
                  .text(formatStep(step*stepSize))
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

      init();

      function init() {
        vehicles = {}
        communities = {}
        tip(".project-info")
        tip.show();
        pause()
        var context = canvas.getContext("2d");
        clear(context);
        d3.select("#staticTooltips").attr('display', 'none')
        var q = queue(1);
        q.defer(loadFile, rootUrl + scenario + "/" + algorithm + "communities.csv", "#loaderVeh") // , gotVehicles) 
        q.awaitAll(gotAllData);

      }
      function gotAllData(error, results) {
        console.log(error, results)
        tip.hide();
        gotVehicles(error, results[0]);
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
            cb(null, null)
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm + " " + url);
          })
          .get();
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
        initialiseSlider(firstStep/stepSize, (lastStep-1)/stepSize, stepSize/stepSize, onStepUpdated)
         
        canvas.style.position = "relative";
        var root = $('body #visualisation');
        canvas.width = width;
        canvas.height = height;
        
        updateColorScales(data);
        updateMaxArea(areaRatio);
        updateAreaScales(data);
        drawVehicles(canvas, step);
      }

      function drawVehicles(canvas, step) {
        context = canvas.getContext("2d");
        clear(context);
        d3.selectAll(".custom-circle").remove()
        for (v in vehicles[step].values) {
          var vehicle = vehicles[step].values[v];
          var x = xScale(vehicle.x);
          var y = yScale(vehicle.y);
          var color = colorScales[colorMetric](vehicle[colorMetric]) 
          if (colorMetric == "dynamism") {
            if (vehicle[colorMetric] > 2) {
              color = "green";
            } 
            else if (vehicle[colorMetric] < -2) {
              color = "red";
            }
            else {
              color = "yellow";
            }

          }
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
        dateLabel.text(formatStep(step*stepSize))        
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
     
      $('.sort-by').on('change', function(){
        var newMetric = $(this).val()
        if (sortMetric === newMetric) return
        sortMetric = newMetric
        updateAreaScale(sortMetric)
        drawVehicles(canvas, step)
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
        if (step < lastStep) {
          step += 1;
        }
        else {
          step = firstStep;
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