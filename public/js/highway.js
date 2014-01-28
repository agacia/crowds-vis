window.onload = function() {
  var width = window.innerWidth, height = window .innerHeight
        , vis = d3.select('body #container').append('svg').attr('class', 'vis')
          .style({ width: width + 'px', height: height + 'px' })
        , node, max, margin = 10, max_area = 800, tooltip
        , min_width = 600
        , min_height = 200
        , toolbar_height = 60
        , margin_top = (width > 450) ? 0 : 5
        , margin_top = 0, margin_bottom  = 10
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
            if ( w < min_width) {
              w = min_width
              r = w
              h = areaRatio * r;
            }
            if (h < min_height) {
              w = h / areaRatio
              r = h
              h = min_height;
            }
            d3.select('.vis').style({ width: w+ 'px', height: h+ 'px'})
            return {"r":r, "width":w, "height":h}
        }
        , max_area = calcBestArea(areaRatio)
        , areaScale = d3.scale.linear().range([0, max_area.r])
        , yScale = d3.scale.linear().range([margin_top, max_area.height - margin_bottom - margin_top])
        , xScale = d3.scale.linear().range([margin, max_area.width - margin])
        , maxY = 0
        , areaToRadius = function(area, scale){ return Math.sqrt( scale * area / Math.PI) }
        , fisheye = null
        , fisheye = d3.fisheye.circular().radius(20).distortion(5)
        , color = d3.scale.category20()
        , colorMetric = 'com_id'
        , sortMetric = $('.sort-by').val()
        , algorithm = $('.algorithm-select').val()
        , firstStep = 0, step = 0, lastStep = 0, stepSize = 0
        , id = 0, order = 0
        , radius = function(d){ 
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
        , dataKey = function(d){ return d.id }
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
            // d.id = id++;
            // d.node_id = d.id
            // d.order = order++;
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
        , scenario = $('.scenario-select').val()
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
        , tip = new InfoTooltip()

      $(".slider").slider()
        .find(".ui-slider-handle")
        .append(dateLabel)

      tip(".project-info")
      tip.show();

      if ( window.self !== window.top ){
        $("wrapper").addClass('in-frame')
        // we're in an iframe! oh no! hide the twitter follow button
      }
      loadFiles(rootUrl, scenario, algorithm, filename);
      createStaticTooltip();
      vis.call(createTooltip)   


      function onStepUpdated() {
        showVehicles(vehicles[step])
        dateLabel.text(step)        
        updateStaticTooltip(step);
      }

      function loadFiles(rootUrl, scenario, algorithm, baseFilename){
        $('.loader').show()
        vehicles = {};
        dataLoaded = 0;
        vis.selectAll('.node').remove()
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
          areaRatio = 0.2;
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
        for (var i = firstStep; i < lastStep; i += stepSize) {
          var reqUrl = rootUrl + scenario + "/" + algorithm + "/groups/" + baseFilename + ("0000" + i).slice(-4) + ".tsv"
          // 'data/MobileLeung/communities.tsv'
          d3.tsv(reqUrl, formatGroup, function(err, rows){
            dataLoaded += 1
            if (dataLoaded == lastStep/stepSize) {
              $('.loader').hide()
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
        $('.loader').show()
        d3.tsv(url, format, function(err, rows){
          if(err) {
            $('.error').html("No data for " + scenario + " with algorithm " + algorithm);
          }
          else {
            $('.error').html("");
            // get only for a single step at once
            for (var i = firstStep; i < lastStep; i += stepSize) {
              vehicles[step] = $.grep(vehicles, function(el, i) { return el.step === step });
            }
            updateXScale("x");
            updateYScale("y");
            step = firstStep;
            showVehicles(vehicles[step])
          }
        })
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
        tip.hide();
        // console.log("showing step ", step, vehicles)  
        updateAreaScale(sortMetric)
        var exitNodes = vis.selectAll('.node').data(vehicles, dataKey).exit()
        exitNodes.remove();
        newNodes = vis.selectAll('.node').data(vehicles, dataKey)
          .enter()
            .append('g')
            .attr('class', 'node')  
        newNodes.on('click', function(){
          var sel = d3.select(this);
          vis.selectAll('.node').classed('selected', false);
          sel.classed('selected', !d3.select(this).classed('selected'))
          var startTracking = d3.select(this).classed('selected')
          if (startTracking) {
            d3.select('.staticTooltip.vehicle').style('display', 'block')
            trackedNode = sel;
            updateStaticTooltip(step);
          }
          else {
            trackedNode = 0
            d3.select('.staticTooltip.vehicle').style('display', 'none')
          }
        });
        newNodes.append('circle')
        node = vis.selectAll('.node')
        node
          .call(updatePos) 
          .call(updateColor)
        fisheyeEffect(vis)
      }      
      function updateXScale(metric) {
        // yScale = d3.scale.linear().range([margin_top, max_area.h - margin_bottom - margin_top])
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
        // desc.append('text').attr('class','position').text('position: ').attr('transform', 'translate(5,105)')
        return tooltip
      }
      function createStaticTooltip(){
        // vehicle info 
        var staticToltipType = "vehicle"
        staticTooltip = d3.select("body").append('div').attr('class', 'staticTooltip '+staticToltipType);
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
        staticTooltip.append('div').attr('class', 'bg');
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
        return staticTooltip
      }
      function updateStaticTooltip(step) {
        if (trackedNode && trackedNode.data() && trackedNode.data().length > 0) {
          // find node's data for the current step
          trackedNode = vis.selectAll('.node').filter(function(d, i) { return d['id']==trackedNode.data()[0]['id']  ? d : null });
          trackedNode.classed('selected',true)
          d = trackedNode.data()[0];
          if (d) {
            // console.log("show data ", trackedNode.data()[0]['id'])
            // staticTooltip.select('rect').transition().attr({ width: 250, height: 100, rx: 5, ry: 5, class: 'bg' })
            staticTooltip.select('.main').text("Tracked vehicle:")
            staticTooltip.select('.id').text('Vehicle: ' + d.id)
            staticTooltip.select('.degree').text('Degree: ' + d.degree)
            staticTooltip.select('.com_id').text('Com_id: ' + d.com_id)
            staticTooltip.select('.com_size').text('Com size: ' + d.com_size)
            //trackedNode.classed('selected')
          }
        }
      }
      function posTooltip(d) {
        var   posX = d.fisheye ? d.fisheye.x : xScale(d.x)
            , posY = maxY-d.y
            , posY = d.fisheye ? d.fisheye.y : yScale(posY)
            , text = "size by : " + sortMetric
        
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
        node.style('fill', function(d){ return color(d[colorMetric]) })
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
        sortMetric = newMetric;
        updateAreaScale(sortMetric);
        pause();
        node.transition().duration(1000).call(updatePos);
      })
      $('.algorithm-select').on('change', function(){
        var newAlgorithm = $(this).val();
        if (algorithm === newAlgorithm) return
        algorithm = newAlgorithm;
        pause();
        loadFiles(rootUrl, scenario, algorithm, filename);
      })
      $('.scenario-select').on('change', function(){
        var newScenario = $(this).val()
        if (scenario === newScenario) return
        scenario = newScenario;
        pause();
        loadFiles(rootUrl, scenario, algorithm, filename);
      })
      $(window).resize(function(){
        width = window.innerWidth
        height = window.innerHeight
        // if(width < 450) margin_top = 20
        // else margin_top = 120
        vis.style({ width: width + 'px', height: height + 'px' })
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
        // console.log("area", area)
        xScale.range([margin, area.width - margin])
        h = area.height - margin_bottom - margin_top - toolbar_height;
        if (scenario == "Highway") {
          h -= toolbar_height;
        }
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
          // $(this).addClass("pause");
          // $(this).removeClass("play");
          play();
        }
        else {
          // $(this).addClass("play");
          // $(this).removeClass("pause");
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
        $('.playbutton').addClass("pause");
          $('.playbutton').removeClass("play");
        timer = setTimeout(function() {  
          play();
        }, timerDelay);
      }
      function pause() {
        if (timer) {
          clearTimeout(timer);
          timer = 0
          $('.playbutton').addClass("play");
          $('.playbutton').removeClass("pause");
        }
      }
    }