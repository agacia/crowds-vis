window.onload = function() {
  var 
      width = parseInt(d3.select(".vis-column").style("width"))
      , height = width
      , canvas = d3.select("body #visualisation")
          .attr("width", width)
          .attr("height", height)
          .append('canvas')
            .attr("width", width)
            .attr("height", height)
            .node()
      , canvas_network = d3.select("body #visualisation-network")
          .attr("width", width)
          .attr("height", height)
          .append('canvas')
            .attr("width", width)
            .attr("height", height)
            .node()
      , max, margin = 0, max_area = 800, tooltip
      , margin_top = 0, margin_bottom  = 0
      , areaRatio = 1
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
      , areaScales = {
          "communities": 
            {
              "x": d3.scale.linear().range([margin, max_area - margin]),
              "y": d3.scale.linear().range([margin_top, max_area - margin_bottom - margin_top])
            },
          "network" :
            {
              "x": d3.scale.linear().range([margin, max_area - margin]),
              "y": d3.scale.linear().range([margin_top, max_area - margin_bottom - margin_top])
            }
        }
      , colors = ["#d73027", "#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850"]
      , colorScales = {
        "com_id": d3.scale.category20(),
        // "avg_speed_avg": d3.scale.quantile().range(d3.range(9)),
        // "avg_speed_avg": d3.scale.ordinal().range(colors),
        "avg_speed_avg": d3.scale.linear().range(["#d73027","#1a9850"]),
        "avg_speed_std": d3.scale.linear().range(["#1a9850","#d73027"]),
        "congested_sum": d3.scale.linear().range(["#1a9850","#d73027"])}
      , colorMetric = 'com_id'
      , colorMetric = $('.color-by').val()
      , algorithm = $('.algorithm-select').val()
      , firstStep = 0, step = 0, lastStep = 0, stepSize = 0
      , id = 0, order = 0
            , stepsOffset = 1682
      , rootUrl = 'data/'
      , scenario = "Manhattan/30012014"
      , filePrefix = ""
      , slider
      , formatStep = function(step) {
        var seconds = step + stepsOffset
        if ((lastStep - firstStep) > 120) {
         return (seconds/60).toFixed(2) + " min"
        }
        return seconds + " s"
      }
      , dateLabel = $("<div/>")
                  .css({ position : 'absolute' , top : 0, left : 0, width: "60px"})
                  .text(formatStep(step))
      , timer
      , timerDelay = 100
      , communitiesDimensions = {}
      , monsterSortMetric = "count"
      , tip = new InfoTooltip()
      , nest = []
      , communitiesNest = []
      , voronoi = d3.geom.voronoi()
          .x(function(d){return d.x})
          .y(function(d){return d.y})
            .clipExtent([[0, 0], [width, height]])
      , network = []
      , networkR = 10
      , colorMap = {}
      

      init();

      function dataKey(d){ return d.node_id }
      function format(d) { // when read cvs
          var numKeys = ['node_id', 'step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size', 'speed', 'num_stops', 'is_originator'];
          numKeys.forEach(function(key){ d[key] = Number(d[key]) })
          d.id = d.node_id;
          return d;
      }
      function formatGroup(d){ // when read cvs
          var numKeys = ['step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'cos_score', 'com_size'];
          numKeys.forEach(function(key){ d[key] = Number(d[key]) })
          d.order = order++;
          return d;
      }
      
      if ( window.self !== window.top ){
        // we're in an iframe!
      }

      function init(reload) {
        communitiesDimensions.length = 0;
        nest.length = 0;
        colorMap.length = 0;
        network.length = 0;
        clear(canvas);
        clear(canvas_network)
        console.log("downloading data")
        reload = reload || false;
        tip(".project-info")
        tip.show();
        // var q = queue(1);
        // // q.defer(function(par, cb) { console.log("in cb1", par); cb(null, par); }, "par1")
        // q.defer(loadFile, rootUrl + scenario + "/" + algorithm + "/communities_pandas.tsv", "#loaderCom") //, gotCommunities) 
        // q.defer(loadFile, rootUrl + scenario + "/" + algorithm + "/communities.csv", "#loaderVeh") // , gotVehicles) 
        // if (!reload) { // load network for the first time only
        //   q.defer(d3.json, rootUrl+scenario+"/"+"Network_v4.json") //, gotNetworkData)
        // }
        // q.awaitAll(gotAllData);
        loadFile(rootUrl + scenario + "/" + algorithm + filePrefix + "communities.csv", "#loaderVeh", gotVehicles);
        loadFile(rootUrl + scenario + "/" + algorithm + filePrefix + "communities_pandas.tsv", "#loaderCom", gotCommunities);
        if (!reload) d3.json(rootUrl+scenario+"/"+"Network_v4.json", gotNetworkData);
      }

      function gotAllData(error, results) {
        tip.hide();
        // console.log("got all data, error", error, "results", results)
        var intersections = 21;
        gotCommunities(error, results[0]);
        gotVehicles(error, results[1]);
        if (results.length > 1) {
          gotNetworkData(error, results[2]);
        }
        console.log("redrawing step... ", step)
        redraw(step);
      }
      
      function gotNetworkData(error, data) {
        var intersections = 21;
        network = []
        data.forEach(function(row,i){
            row.forEach(function(inter,j){
              //d3.select("#display").append("circle").attr("class","inter").attr("r",10).attr("cx",(i+1)*500/23).attr("cy",(j+1)*500/23).style("fill","red").datum([(i+1)*4600/23,(j+1)*4600/23])
              if (0 < i && i < intersections && 0 < j && j < intersections ) {
                network.push({"x":i,"y":j}) 
              } 
            })
          })
          networkR = max_area / intersections / 2 ;
          updateAreaScales({"network":network})
          network.forEach(function(d) { 
            d.x = Math.floor(areaScales["network"]["x"](d.x));
            d.y = Math.floor(areaScales["network"]["x"](d.y));
          });
          // console.log("loaded network", network, max_area)
      }

      function loadFile(url, loader, cb) {
        $(loader).show()
        return xhr = d3.tsv(url)
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
            $('.error').html("");
            d3.select('body').selectAll('.chart').selectAll().remove()
            d3.select(".data-status").html("Loaded " + data.length + " rows of data...")
            cb(null, data)
          })
          .on("error", function(error) { 
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm + " " + url);
          })
          .get();
      }
      function gotCommunities(error, data) {
        data = data.map(function(d) {
          com = {}
          com.step = +d["('step', '')"]
          com.com_id = +d["('com_id', '')"]
          com.count = +d["('com_size', 'size')"]
          com.range = +d["('range', '')"]
          com.speed_avg = +d["('speed', 'mean')"] > 0 ? +d["('speed', 'mean')"] : 0
          com.speed_min = +d["('speed', 'amin')"]
          com.speed_max = +d["('speed', 'amax')"]
          com.speed_std = +d["('speed', 'std')"]
          com.avg_speed_avg = +d["('avg_speed', 'mean')"] > 0 ? +d["('avg_speed', 'mean')"] : 0
          com.avg_speed_min = +d["('avg_speed', 'amin')"]
          com.avg_speed_max = +d["('avg_speed', 'amax')"]
          com.avg_speed_std = +d["('avg_speed', 'std')"]
          com.num_stops_sum = +d["('num_stops', 'sum')"]
          com.num_stops_avg = +d["('num_stops', 'mean')"] > 0 ? +d["('num_stops', 'mean')"] : 0
          com.num_stops_min = +d["('num_stops', 'amin')"]
          com.num_stops_max = +d["('num_stops', 'amax')"]
          com.num_stops_std = +d["('num_stops', 'std')"]
          com.congested_sum = +d["('congested', 'sum')"]
          return com;
        })
        
        updateColorScales(data);
        communitiesNest = d3.nest()
          .key(function(d) { return d.step; })
          .entries(data);

        // var cf = crossfilter(data);
        // // time dimension
        // var timeDimension = cf.dimension(function(d) {
        //   return d.step;
        // })
        // var steps = timeDimension.group().reduceCount().all()
        // for (var i in steps) {
        //   var dim = crossfilter(timeDimension.filter(i).top(Infinity)).dimension(function(d) {
        //     return d.count
        //   })
        //   communitiesDimensions[i] =  dim
        // }
        // timeDimension.filter(null);

        console.log("got communities", data, "steps loaded ", communitiesNest.length)
      }

      function gotVehicles(error, data) {
        tip.hide();
        updateAreaScales({"communities":data})
        data.forEach(function(d){
          d.step = +d.step
          d.x = areaScales["communities"]["x"](+d.x),
          d.y = areaScales["communities"]["y"](+d.y)
        })
        nest = d3.nest()
          .key(function(d) { return d.step; })
          .entries(data);

        if (nest.length > 0) {
          firstStep = +nest[0].key;
          lastStep = +nest[nest.length-1].key;
          step = firstStep;
        }
        stepSize = 1;
        if (nest.length > 1) {
          stepSize = +nest[1].key - firstStep;
        }
        initialiseSlider(firstStep, lastStep, stepSize, onStepUpdated)

        for (time in nest) {
          // console.log("communitiesDimensions",time, communitiesDimensions)
          // var stepCommunities = communitiesDimensions[time].bottom(Infinity);
          var stepCommunities = communitiesNest[time].values;
          nest[time].values.forEach(function(d) {
            var com = stepCommunities.filter(function(c) { return c.com_id == d.com_id}) 
            d["avg_speed_std"] = com[0].avg_speed_std;
            d["avg_speed_avg"] = com[0].avg_speed_avg;
            d["congested_sum"] = com[0].congested_sum
          })
        }

        redraw(step)
        console.log("got vehicles", nest, nest.length)
      }

      function redraw(time) {
        time /= stepSize;
        redrawCommunities(time);
        // redrawTable(time);
      }
      function redrawCommunities(time) {
        var ctx = canvas.getContext('2d');
        var vertices = nest[time].values; //.forEach(function(vehicles) {
        voronoi(vertices).forEach(function(d,i) {
          if (d.length > 0) {
            var color = colorScales[colorMetric](vertices[i][colorMetric]);
            // console.log(colorMetric, vertices[i][colorMetric], color)
            colorMap[color] = vertices[i].com_id
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(d[0][0], d[0][1]);
            d.forEach(function(point){
              ctx.lineTo(point[0],point[1])
            })
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        })   
        redrawNetwork(time);
      }

      function dec2hex(dec) {
        var hex = dec.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
      }
      function rgb2hex(red, green, blue) {
        return '#' + dec2hex(red) + dec2hex(green) + dec2hex(blue);
      }

      function redrawNetwork(time) {
        // network
        var ctx2 = canvas_network.getContext('2d');
        var ctx = canvas.getContext('2d');
        network.forEach(function(d){
          if (d.x == max_area) {
            d.x --;
          }
          if (d.y == max_area) {
            d.y --;
          }
          var colorData = ctx.getImageData(d.x,d.y,1,1)
          var color = rgb2hex(colorData.data[0], colorData.data[1], colorData.data[2])
          ctx2.fillStyle = color;
          ctx2.beginPath();
          ctx2.arc(d.x, d.y, networkR, 0, 2 * Math.PI, false);
          ctx2.closePath();
          ctx2.fill();
          //ctx2.stroke();
        })

        // nest.filter(function(step) {return step.key == time}).forEach(function(timeStep){
        //   timeStep.values.forEach(function(d){
        //     ctx2.fillStyle = "white"
        //     ctx2.beginPath();
        //     ctx2.arc(d.x, d.y, 2, 0, 2 * Math.PI, false);
        //     ctx2.closePath();
        //     ctx2.fill();
        //   })
        // })  
      }

      function redrawTable(step, asc) {
        asc = asc || false;
        var stepCommunities = communitiesDimensions[step].bottom(Infinity);
        d3.select(".communities-stats")
          .select('.num-communities').text("Number of communities: " + stepCommunities.length)
        
        var monsterTable = dc.dataTable("#dc-monster-graph");
        monsterTable.width(800).height(800)
          .dimension(communitiesDimensions[step])
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
      }

      function orderValue(p) {
        return p[monsterSortMetric];
      }

      function clear(canvas) {
        canvas.width = canvas.width;
        // canvas_network.width = canvas_network.width;
        // ctx.beginPath();
        // ctx.clearRect(0, 0, width, height);
        // ctx.closePath();
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
        dateLabel.text(formatStep(step));
        redraw(step); 
      }

      function updateAreaScales(data) {
        for (var key in areaScales) {
          if (key in data) {
            minX = d3.min(data[key], function(d) {return d.x; })
            maxX = d3.max(data[key], function(d) {return d.x; })
            minY = d3.min(data[key], function(d) {return d.y; })
            maxY = d3.max(data[key], function(d) {return d.y; })
            areaScales[key]["x"].domain([minX,maxX])
            areaScales[key]["y"].domain([minY,maxY])
            // console.log(key, "x", minX, maxX, "y", minY, maxY)
          }
        }
      }
      
      function updateColorScales(data) {
        d3.selectAll(".legend-item").remove();

        for (var metric in colorScales) {
          if (metric != "com_id") {
            var maxVal = d3.max(data, function(d){ return d[metric] })
            var minVal = d3.min(data, function(d){ return d[metric] })
            var colors = []
            var scaleLen = colorScales[metric].range().length;
            if (scaleLen < 9) {
              scaleLen = 9
            }
            var maxValue = maxVal;
            if (metric === "avg_speed_avg") {
              // todo
              maxVal = 15;
            }
            colorScales[metric].domain([minVal, maxVal])  
            
            var interval = (maxVal - minVal)/scaleLen;
            for (var i in d3.range(scaleLen)) {
              var value = minVal + i * interval;
              colors.push({"value":Math.round(value), "color":colorScales[metric](value)})
            }
            createLegend(metric, colors, maxValue)
          }
        }
      }

      function createLegend(metric, colors, maxValue) {
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
          legend.append('span')
            .attr('class', 'maxval')
            .style('margin-left','8px')
            .text("Max: " + maxValue.toFixed(2))
      }

      $('.color-by').on('change', function(){
        var newMetric = $(this).val()
        if (colorMetric === newMetric) return
        colorMetric = newMetric 
        redraw(step)
      })
      $('.algorithm-select').on('change', function(){
        var newAlgorithm = $(this).val()
        if (algorithm === newAlgorithm) return
        algorithm = newAlgorithm;
        pause()
        d3.select("#staticTooltips").attr('display', 'none')
        init(false);
        // loadFile(rootUrl + scenario + "/" + algorithm + "/communities_pandas.tsv", "#loaderCom", gotCommunities);
        // loadFile(rootUrl + scenario + "/" + algorithm + "/communities.csv", "#loaderVeh", gotVehicles);
      })

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
          step += stepSize;
          onStepUpdated();
          slider.slider({value :step });
          timer = setTimeout(function() {  
            play();
          }, timerDelay);
        }
        else {
          pause();
        }
      }
      function pause() {
        if (timer) {
          clearTimeout(timer);
          timer = 0
        }
      }
    }