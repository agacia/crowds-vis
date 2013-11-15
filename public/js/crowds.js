window.onload = function() {
  var width = window.innerWidth, height = window.innerHeight
        , vis = d3.select('body #container').append('svg').attr('class', 'vis')
          .style({ width: width + 'px', height: height + 'px' })
        , node, max, margin = 20, max_area = 500, tooltip
        , margin_top = (width > 450) ? 100 : 20
        , margin_bottom = 50, steps_x = 100, steps_y = 28
        , calcBestArea = function(){
          // var r1 = (width / steps_x) / 1.4
          //   , r2 = (height / steps_y) / 1.4
          //   , r = r1 < r2 ? r1 : r2
          // return Math.PI * r * r
          var r1 = (width ) 
            , r2 = (height)
            , r = r1 < r2 ? r1 : r2
            return r*1.4
        }
        , max_area = calcBestArea()
        , areaScale = d3.scale.linear().range([0, max_area])
        , xScale = d3.scale.linear().range([margin, margin + max_area])
        , yScale = d3.scale.linear().range([margin_top,margin_top + max_area])
        , maxY = 0
        , areaToRadius = function(area, scale){ return Math.sqrt( scale * area / Math.PI) }
        , fisheye = null
        , fisheye = d3.fisheye.circular().radius(40).distortion(2)
        , color = d3.scale.category20()
        , colorMetric = $('.color-by').val()
        , sortMetric = $('.sort-by').val()
        , id = 0, order = 0
        , radius = function(d){ 
          var metric = sortMetric
          var scale = 1
          if (metric == "com_score") {
            scale = 0.5;
          }
          return areaToRadius(areaScale(d[metric]), scale) 
        }
        , x = d3.scale.linear().domain([0, steps_x]).range([margin, width - margin])
        , y = d3.scale.linear().domain([0, steps_y]).range([margin_top, height - margin_bottom])
        , dataKey = function(d){ return d.date }
        , sortBy = function(by){ return function(a, b){ 
            if(a[by] === b[by]) return 0; else if(a[by] > b[by]) return -1;
            return 1;
        }}
        , projection = d3.geo.albers()
        , money = d3.format('$,04d')   
        , format = function(d){ // when read cvs
            // step  node_id x y degree  neighbors cc_id cc_size com_id  com_score com_size
            var numKeys = ['step', 'x', 'y', 'degree', 'cc_id', 'cc_size', 'com_id', 'com_score', 'com_size'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            d.id = id++;
            d.order = order++;
            return d;
        }
        , topNode = null
        , firstStep = 0, lastStep = 10, step = 0
        , slider = $( ".slider" ).slider({
            min: firstStep,
            max: lastStep,
            value: firstStep,
            slide: function( event, ui ) { 
              step = ui.value; 
              var stepVehicles = $.grep(vehicles, function(el, i) { return el.step === step });
              // console.log("step ", step, " vehicles: ", stepVehicles.length, stepVehicles);
              gotVehicles(stepVehicles)
            }
          })

      if ( window.self !== window.top ){
        // we're in an iframe! oh no! hide the twitter follow button
      }
      vis.call(createTooltip)
      d3.tsv('data/MobileLeung/communities.tsv', format, function(err, rows){
        if(err) throw err
        vehicles = rows
        // console.log("loaded data ", vehicles);
        updateXScale("x");
        updateYScale("y");

        // get only for a single step at once
        var stepVehicles = $.grep(vehicles, function(el, i) { return el.step === step });
        // console.log("step data ", stepVehicles);
        gotVehicles(stepVehicles)
        fisheyeEffect(vis)
      })
      function gotVehicles(vehicles){
        // updateAreaScale(sortMetric)        
        var exitNodes = vis.selectAll('.node').data(vehicles, dataKey).exit().remove();
        node = vis.selectAll('.node').data(vehicles)
          .enter().append('g')
            .attr('class', 'node')     
        node.on('click', function(){
          var node // = d3.select('.node.highlighted').classed('highlighted', false).node()
            , sel = d3.select(this)
          if(sel.node() !== node) sel.classed('highlighted', !d3.select(this).classed('highlighted'))
        })
        node.append('circle')
          .attr('x',0)
          .attr('y',0)
          .call(updateColor)
          .call(updatePos) 
          // .call(fisheyeEffect)
          // .call(tooltipEffect);
        node.transition().duration(1000).call(updatePos) 
      }
      function updateXScale(metric) {
        // x range 15423.98 - 48127.1
        var max = d3.max(vehicles, function(d){ 
          return d[metric] })
        xScale.domain([0, max])
      }
      function updateYScale(metric) {
        // y range 9717.82 - 37499.01 
        maxY = d3.max(vehicles, function(d){ 
          return d[metric] })
        yScale.domain([0, maxY])
      }
      function updateAreaScale(sortMetric){
        var metric = sortMetric
        areaScale.domain([0, d3.max(vehicles, function(d){ 
          return d[metric] })])
      }
      function createTooltip(vis){
        tooltip = vis.append('g').attr('class', 'tooltip')
        tooltip.append('rect').attr({ width: 130, height: 200, rx: 5, ry: 5, class: 'bg' })
        var desc = tooltip.append('g').attr('class', 'desc')
        desc.append('text').attr('class', 'main').text('').attr('transform', 'translate(5,5)')
        desc.append('text').attr('class', 'node_id').text('Vehicle: ').attr('transform', 'translate(5,25)')
        desc.append('text').attr('class','degree').text('Degree: ').attr('transform', 'translate(5,45)')
        desc.append('text').attr('class', 'com_id').text('Community id: ').attr('transform', 'translate(5,65)')
        desc.append('text').attr('class','com_size').text('Community size: ').attr('transform', 'translate(5,85)')
        return tooltip
      }
      function posTooltip(d) {
        var   x = d.fisheye ? d.fisheye.x : xScale(d.x)
            , y = d.fisheye ? d.fisheye.y : yScale(maxY-d.y)
            , text = "size by : " + sortMetric
        tooltip.select('.main').text(text)
        tooltip.select('.node_id').text('Vehicle: ' + d.node_id)
        tooltip.select('.degree').text('Degree: ' + d.degree)
        tooltip.select('.com_id').text('Com_id: ' + d.com_id)
        tooltip.select('.com_size').text('Com size: ' + d.com_size)
        var box = tooltip.select('.desc').node().getBBox()
        box.x -= 10, box.y -= 10, box.width += 20, box.height += 20
        tooltip.select('rect').attr(box)
        var offset = d.fisheye? radius(d) * d.fisheye.z : radius(d);
        if( x > width / 2 ) x -= box.width + offset; else x+= offset
        if( y > height / 2 ) y -= box.height + offset; else y+= offset
        tooltip.attr('transform', 'translate(' + x + ',' + y + ')')
      }

      function updatePos(node){
        // node.attr('transform', function(d){    
        //   y = maxY - d.y
        //   return 'translate(' + xScale(d.x) + ',' + yScale(y) + ')'
        // })
        node.attr('cx', function(d){    
          return xScale(d.x);
        })
        node.attr('cy', function(d){    
          y = maxY - d.y
          return yScale(y)
        })
        updateAreaScale(sortMetric)
        node.select('circle').attr('r', radius)
        return node
      }
      function updateColor(node){
        node.style('fill', function(d){ return color(d[colorMetric]) })
        node.style("fill-opacity", .8)
      }
      function setFisheyePos(node){
        // node.attr('transform', function(d, i){
        //   console.log("transform d.fisheye", d.fisheye)
        //   return 'translate(' + d.fisheye.x + ', ' + d.fisheye.y + ')'
        // })
        if (node && node.select('circle') && node.select('circle').length > 0) {
          node.select('circle')
            .attr('cx', function(d){    
              return 0 // return d.fisheye.x;
            })
            .attr('cy', function(d){    
              return 0 // return d.fisheye.y
            })
            .attr('transform', function(d){    
              return 'translate(' +  d.fisheye.x + ' , ' +  d.fisheye.y + ')';
            })
            .attr('r', function(d){
              var z = d.fisheye && d.fisheye.z || 1
              if (z > 1 ) { 
                z *= 2
              }
              return radius(d) * z;
            })
            // .attr('transform', function(d){
            //   var z = d.fisheye && d.fisheye.z || 1
            //   return 'scale(' + z + ')'
            // })
          // node.attr('transform', function(d, i){
          //   return 'translate(' + d.fisheye.x + ', ' + d.fisheye.y + ')'
          // })
          // node.select('circle').attr('transform', function(d){
          //   var z = d.fisheye && d.fisheye.z || 1
          //   return 'scale(' + z + ')'
          // })
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
        if(sortMetric === newMetric) return
        sortMetric = newMetric
        node.transition().duration(1000).call(updatePos)
      })
      $('.color-by').on('change', function(){
        var newMetric = $(this).val()
        // console.log("newMetric", newMetric)
        if(newMetric === colorMetric) return
        colorMetric = newMetric
        node.transition().duration(2000).call(updateColor)
      })
      $(window).resize(function(){
        width = window.innerWidth
        height = window.innerHeight
        if(width < 450) margin_top = 20
        else margin_top = 120
        vis.style({ width: width + 'px', height: height + 'px' })
        x.range([margin, width - margin])
        y.range([margin_top, height - margin_bottom])
        node.call(grid).call(updatePos)
        updateMaxArea()
        node.select('circle').attr('r', radius)
      })
      function tooltipEffect(vis) {
         return vis.on('mouseover', function(d){
            d3.select('.tooltip').style('display', 'inherit')
            posTooltip(d)
          })
          .on('mouseleave', function hideTooltip(d) {
            d3.select('.tooltip').style('display', 'none')
          })
      }
      function fisheyeEffect(vis){
        return vis.on('mouseover', function(d){
          // var circle = d3.select(this);
          if(!node) return
          d3.select('.tooltip').style('display', 'inherit')
          //node.each(function(d, i){  $(this).removeClass('animated') })
        }).on("mousemove", function(d){
          if (!d) {
            var d = d3.select(this).select('circle').datum();
          }
          if (fisheye) {
            var m = d3.mouse(this)
            fisheye.focus(m)
            if(!node) return
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
              if(topNode !== maxNode) updateTopNode(maxNode)
            })
          }
          else {
            posTooltip(d);
          }
        }).on('mouseleave', function(d){
          d3.select('.tooltip').style('display', 'none')
          node.each(function(d, i){ d.fisheye = {x: xScale(d.x), y: yScale(maxY - d.y), z: 1} })
          .filter(function(d){ return d.fisheye.z !== d.fisheye.prev_z })
          .call(setFisheyePos)
        })
      }
      function updateMaxArea(){
        max_area = calcBestArea()
        areaScale.range([0, max_area])
      }

      function updateTopNode(maxNode){
        if (!maxNode) return;
        if(topNode) topNode.classed('active', false)
        topNode = d3.select(maxNode).classed('active', true)
        posTooltip(topNode.datum())
      }
    }