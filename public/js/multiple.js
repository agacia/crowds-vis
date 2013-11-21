window.onload = function() {
  var width = window.innerWidth, height = window .innerHeight
    , format = function(d){ // when read cvs
        // step nodes edges singletons  connected avg_degree  degree_distribution diameter  avg_clustering_coefficient  cc_count  avg_cc_size max_cc_size max_cc_id cc_std_dev  com_count avg_com_size  max_com_size  max_com_id  min_com_size  min_com_id  std_com_dist  modularity  com_modularity  iterations  iteration_modularities
        var numKeys = ['step', 'nodes', 'edges', 'singletons', 'connected', 'avg_degree', 'diameter', 
          'avg_clustering_coefficient', 'cc_count', 'avg_cc_size', 'max_cc_size', 'max_cc_id', 'cc_std_dev',
          'com_count', 'avg_com_size',  'max_com_size',  'max_com_id',  'min_com_size',  'min_com_id', 
          'modularity',  'com_modularity'];
        numKeys.forEach(function(key){ d[key] = Number(d[key]) })
        return d;
    }
    ,graphMetrics = ['nodes', 'edges', 'singletons', 'connected', 'avg_degree', 'diameter', 
          'avg_clustering_coefficient', 'cc_count', 'avg_cc_size', 'max_cc_size', 'max_cc_id', 'cc_std_dev']
    , algorithmMetrics = ['com_count', 'avg_com_size', 'max_com_size', 'max_com_id', 'com_modularity']
    , firstStep = 0, lastStep = 1200, step = 0, stepSize = 10
    , imgWidth = 600
    , imgHeight = 600
    , chartHeight = 200
    , filebase ='img_'
    , fileext = ".jpg"
    , rootUrl = 'http://vehilux.gforge.uni.lu/files/crowds-images/algorithms/'
    , graphRootUrl = 'data/algorithms/'
    , algorithms = ['MobileLeungSDSD', 'SandSharc', 'EpidemicCommunityAlgorithm', 'Leung', 'MobileLeungDSD']
    , downloadedCount = 0
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
    , charts = {}
    , data = {}
    , yScaleMax = 0, yScaleMin = 99999
    , timer
    , timerDelay = 300


  $(".slider").slider()
    .find(".ui-slider-handle")
    .append(dateLabel)

  if ( window.self !== window.top ){
    // we're in an iframe! oh no! hide the twitter follow button
  }

  $('#loader').show();
  initializeSelect();
  initializeGraphMetrics();
  createContainers(algorithms);
  loadGraphFiles(rootUrl);
  showImages(rootUrl, algorithms, filebase, fileext, step);

  function initializeSelect() {
    var selectOptions = [ 'com_count', 'avg_com_size',  'max_com_size', 'com_modularity'];
    d3.select('.sort-by').selectAll('option').remove()
    d3.select('.sort-by').selectAll('option')
      .data(selectOptions)
      .enter()
        .append('option')
        .attr('value', function(d) {return d })
        .text(function(d) {return d })
    yMetric = $('.sort-by').val()
  }

  function initializeGraphMetrics() {
    d3.select('.graph-metrics .metrics').selectAll('span')
      .data(graphMetrics)
      .enter()
        .append('span')
        .attr('class', function(d) { return 'metric '+ d })
        .text(function(d) { 
          metricName = d == 'avg_clustering_coefficient' ? 'clustering_coeff' : d;
          return metricName + ': '})
  }

  function updateGraphMetrics(step) {
    if (algorithms.length == 0) return;
    var graphData = data[algorithms[0]]
    d3.select('.graph-metrics .metrics').selectAll('span')
      .data(graphMetrics)
        .text(function(d) { 
          var value = graphData[step][d]; 
          metricName = d == 'avg_clustering_coefficient' ? 'clustering_coeff' : d;
          if (d!='nodes' && d!='edges' && d!='max_cc_id' && d!='cc_count' && d!='singletons' && d!='connected') {
            value = value.toFixed(2)
          }
          return metricName + ': ' + value});
  }
  function createContainers(algorithms) {
    var steps = d3.range(lastStep/10)
    
    algorithm = d3.select('.algorithms').selectAll('.algorithm')
      .data(algorithms)
      .enter()
        .append('div')
        .attr('class', function(d, i) { return 'algorithm ' + d; })
    
    algorithm.append('p')
      .attr('class','title')
      .text(function(d) { return d;})

    var loadedImgs = 0;
    var totalImgs = algorithms.length * lastStep / stepSize;
    console.log("otal", totalImgs)
    $.each(algorithms, function(algorithm) {
      var algorithmName = algorithms[algorithm]
      d3.select('.algorithm.'+algorithmName)
      .append('div')
      .attr("class","preload")
      .selectAll('img')
      .data(steps)
      .enter()
      .append('img')
        .attr('class', function(d) { return "image id"+d})
        .attr('style', 'display: none')
        .attr('onload', function() {
          loadedImgs += 1
          // console.log("loaded", loadedImgs)   
          if (loadedImgs == totalImgs) {
            console.log("loaded")
            $(".loader").hide()
          }
        })
        .attr('src', function(d) {
          var imgPath = d == 0 ? rootUrl + algorithmName + "/imgs/" + filebase + "0000" + fileext
            : rootUrl + algorithmName + "/imgs/" + filebase + ("000" + (d).toString()).slice(-4) + fileext;
            
          return imgPath;
        });
    });

    $(document).ready(function(){
      console.log("document ready")
    });

    algorithm.append('div')
      .attr('class', 'chart')
      .style({ width: imgWidth + 'px', height: chartHeight + 'px' })
    
    algorithm.append('div')
      .attr('class', 'algorithm-metrics')
      .selectAll('span')
      .data(algorithmMetrics)
      .enter()
        .append('span')
          .attr('class', function (d) { return "metric " + d})
          .text(function (d) { 
            return d + ": " + 0; })
    
    // var preloader = d3.select('.algorithm')
    // $.each(algorithms, function(algorithm) {
    // preloader.append('div')
      // });
    // $('#loader').hide();
    createTooltip(algorithm)
  }

  function updateAlgorithmMetrics(step) {
    $.each(algorithms, function(algorithm) {
      var algorithmName = algorithms[algorithm]
      d3.select('.algorithm.'+algorithmName)
      .selectAll('span')
      .data(algorithmMetrics)
        .text(function (d) { 
          var value = algorithmName == 0 ? 0 : data[algorithmName][step][d];
          if (d=='avg_com_size' || d=='com_modularity') {
            value = value.toFixed(2)
          }
          return d + ": " + value; })
    });
  }

  function onStepUpdated() {
    showImages(rootUrl, algorithms, filebase, fileext, step);
    updateGraphMetrics(step);    
    updateAlgorithmMetrics(step);
    $.each(charts, function (algorithm) { 
      charts[algorithm].moveBrush(step);
    });
    dateLabel.text(step)
  }

  $('.sort-by').on('change', function(){
    var newMetric = $(this).val()
    if(yMetric === newMetric) return
    yMetric = newMetric;
    updateYScale();
    $.each(charts, function (algorithm) { 
      charts[algorithm].update(yMetric, yScaleMin, yScaleMax);
    });
  })

  $('.zoom-in.btn').on('click', function() {
    imgWidth += 10;
    imgHeight += 10;
    chartHeight += 4
    updateSize();
  });

  $('.zoom-out.btn').on('click', function() {
    imgWidth -= 10;
    imgHeight -= 10;
    chartHeight -= 4;
    updateSize();
  });
  
  function updateSize() {
    var width = d3.selectAll('.preload img').style('width')
    d3.selectAll('.preload img')
      .style({ width: imgWidth + 'px', height: imgHeight + 'px' })
    d3.selectAll('.chart')
      .style({ width: imgWidth + 'px', height: chartHeight + 'px' })
    $.each(charts, function(algorithm) {
      charts[algorithm].width(imgWidth)
      charts[algorithm].height(chartHeight)
      charts[algorithm].update(yMetric, yScaleMin, yScaleMax);
      updateGraphMetrics(step);
      updateAlgorithmMetrics(step);
    })
  }

  function showImages(rootUrl, algorithms, baseFilename, fileext, step){
    
    var preloadClass = ".preload img.id" + step/10;
    d3.selectAll('.preload img')
      .attr('style', 'display: none')
    var toShow = d3.selectAll(preloadClass)
    toShow.attr('style', 'display: block')
      // d3.selectAll('.algorithm .image')
      // .data(algorithms)
      
      // .attr('src', function(d) {
      //   var imgPath = step == 0 ? rootUrl + d + "/imgs/" + baseFilename + "0000" + fileext
      //     : rootUrl + d + "/imgs/" + baseFilename + ("000" + (step/10).toString()).slice(-4) + fileext;
      //   return imgPath;
      // })
  }
  function loadGraphFiles(rootUrl) {
    var reqUrl = graphRootUrl + algorithms[downloadedCount] + "/graph.txt"
    d3.tsv(reqUrl, format, function(err, rows) {
      if(err) throw err
      var chart = lineChart()
        .width(imgWidth)
        .x(function(d) { return d["step"]; })
        .y(function(d) { return d[yMetric]; })
      d3.select(".algorithm."+algorithms[downloadedCount]+" .chart")
        .datum(rows)
        .call(chart);
      charts[algorithms[downloadedCount]] = chart;
      data[algorithms[downloadedCount]] = rows;
      downloadedCount += 1;
      if (downloadedCount < algorithms.length) {
        loadGraphFiles(rootUrl)
      }
      else {
        $.each(charts, function(algorithm) {
          updateYScale();
          charts[algorithm].update(yMetric, yScaleMin, yScaleMax);
          updateGraphMetrics(step);
          updateAlgorithmMetrics(step);
        })
      }
    });
  }

  function updateYScale() {
    yScaleMax = 0
    yScaleMin = 999999;
    for (var i in data) {
      yMax = d3.max(data[i], function(d) { return d[yMetric]; })
      yScaleMax = (yMax > yScaleMax) ? yMax: yScaleMax;
      yMin = d3.min(data[i], function(d) { return d[yMetric]; })
      yScaleMin = (yMin < yScaleMin) ? yMin: yScaleMin;
    } 
  }

  function createTooltip(vis){
    d3.select('.tooltip').remove();
    tooltip = vis.append('g').attr('class', 'tooltip')
    tooltip.append('rect').attr({ width: 130, height: 200, rx: 5, ry: 5, class: 'bg' })
    var desc = tooltip.append('g').attr('class', 'desc')
    desc.append('text').attr('class', 'main').text('').attr('transform', 'translate(5,5)')
    desc.append('text').attr('class', 'x').text('x: ').attr('transform', 'translate(5,25)')
    desc.append('text').attr('class','y').text('y: ').attr('transform', 'translate(5,45)')
    return tooltip
  }
  // function posTooltip(d) {
  //   var   posX = d.fisheye ? d.fisheye.x : xScale(d.x)
  //       , posY = maxY-d.y
  //       , posY = d.fisheye ? d.fisheye.y : yScale(posY)
  //       , text = "size by : " + yMetric
  //   tooltip.select('.main').text(text)
  //   tooltip.select('.id').text('Vehicle: ' + d.id)
  //   tooltip.select('.degree').text('Degree: ' + d.degree)
  //   tooltip.select('.com_id').text('Com_id: ' + d.com_id)
  //   tooltip.select('.com_size').text('Com size: ' + d.com_size)
  //   tooltip.select('.position').text('position: ' + posX + ' ' + posY)
  //   var box = tooltip.select('.desc').node().getBBox()
  //   box.x -= 10, box.y -= 10, box.width += 20, box.height += 20
  //   tooltip.select('rect').attr(box)
  //   var offset = d.fisheye? radius(d) * d.fisheye.z : radius(d);
  //   if( posX > width / 2 ) posX -= box.width + offset; else posX+= offset
  //   if( posY > height / 2 ) posY -= box.height + offset; else posY+= offset
  //   tooltip
  //     .attr('x',0)
  //     .attr('y',0)   
  //     .attr('transform', 'translate(' + posX + ',' + posY + ')')
  // }

  // function updatePos(node){
  //   node
  //     .attr('transform', function(d){  
  //       return 'translate(' + xScale(d.x) + ',' + yScale(maxY - d.y) + ')'
  //     })
  //   node.select('circle').attr('r', radius)
  //   return node
  // }
  // function updateColor(node){
  //   node.style('fill', function(d){ return color(d[colorMetric]) })
  //   node.style("fill-opacity", .8)
  // }
  
  // $(window).resize(function(){
  //   width = window.innerWidth
  //   height = window.innerHeight
  //   if(width < 450) margin_top = 20
  //   else margin_top = 120
  //   vis.style({ width: width + 'px', height: height + 'px' })
  //   node.call(updatePos)
  //   updateMaxArea()
  //   node.select('circle').attr('r', radius)
  //   xScale.range([lineChartMargin, lineChartWidth - lineChartMargin])
  //   yScale.range([lineChartHeight - lineChartMargin, lineChartMargin])
  // })

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

