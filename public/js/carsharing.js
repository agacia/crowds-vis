window.onload = function() {
  var 
        firstStep = 0, step = 0, lastStep = 0, stepSize = 0
        , order = 0
        , dateFormat = d3.time.format("%Y-%m-%d %X") // 2013-05-17 18:16:41
        , context
	    , getTimeDifference = function(msec) {
	    	if (msec === undefined ) {
	    		return 0
	    	}
	    	var diff = {}
	    	diff.hh = Math.floor(msec / 1000 / 60 / 60);
	    	msec -= diff.hh * 1000 * 60 * 60;
	    	diff.mm = Math.floor(msec / 1000 / 60);
	    	msec -= diff.mm * 1000 * 60;
	    	diff.ss = Math.floor(msec / 1000);
		    msec -= diff.ss * 1000;
			var duration = diff.hh * 60 + diff.mm
		    return duration;
	    }
        , format = function(d) { 
	        // var numberFormat = d3.format(".2f");
		    var numKeys = ['StartLongitude', 'StartLatitude', 'EndLongitude', 'EndLatitude'];
            var timeKeys = ['Start', 'End'];
            numKeys.forEach(function(key){ d[key] = Number(d[key]) })
            timeKeys.forEach(function(key) { 
            	d[key] = new Date(d[key])
            	d[key+"Hour"] = d[key].getHours();
            	// if (!d[key].trim()) {
            	// 	return null;
            	// }
            	// d[key] = dateFormat.parse(d[key].trim());
            	// console.log("d[date]", d[key])
            	// d[key+"Hour"] = d3.time.hour(d[key]); // pre-calculate hour for better performance
            })
            d.tripDurationMsec = d.End - d.Start;
            d.tripDuration = getTimeDifference(d.tripDurationMsec);
            d.order = order++;
            return d;
        }
        , rootUrl = 'data/'
        , scenario = 'Miami'
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
        , timer
        , timerDelay = 300
        , charts = {}


      $(".slider").slider()
        .find(".ui-slider-handle")
        .append(dateLabel)

      if ( window.self !== window.top ){
        // we're in an iframe! oh no! hide the twitter follow button
      }

      createChartObjects();
      loadFile(rootUrl + scenario + "/Miami-Trips-JuneJuly2013.tsv");
     
      function createChartObjects() {
      	// charts["gainOrLossChart" = dc.pieChart("#gain-loss-chart");
		charts["tripsLength"] = dc.barChart("#trips-length-chart");
		// charts["dayOfWeekChart"] = dc.rowChart("#day-of-week-chart");
		// charts["moveChart"] = dc.lineChart("#monthly-move-chart");
		// charts["volumeChart"] = dc.barChart("#monthly-volume-chart");
		// charts["yearlyBubbleChart"] = dc.bubbleChart("#yearly-bubble-chart");

      }
      function onStepUpdated() {
        dateLabel.text(step)      
      }
      function loadFile(url) {
        $('.loader').show()
        d3.tsv(url, format, function(err, data){
          if(err) {
            $('.error').html("No data for " + scenario + " " + url);
          }
          else {
            $('.loader').hide();
            $('.error').html("");
           	console.log("downloaded data" , data)
           	cubs(data);
           	drawCharts(data)
           	dc.renderAll();
          }
        })
      }
      function cubs(data) {
      	context = cubism.context()
                    .step(6e4) // Distance between data points in milliseconds
                    .size(1000) // Number of data points
                    .stop();   // Fetching from a static data source; don't update values

        d3.select("#cubs").append("div") // Add a vertical rule
              .attr("class", "rule")        // to the graph
              .call(context.rule())


        draw_graph(["Miami-Trips-JuneJuly2013"]);

      }

	function getMetric(name) { 
	    var metric = context.metric(function(start, stop, step, callback) {
	    	console.log("start", start, stop, step)
	        d3.tsv("data/Miami/" + name + ".tsv", format, function(err, data){
	          if(err) {
	            $('.error').html("No data for " + scenario + " " + url);
	          }
	          else {
		        	// Creates an array of the data values
		        	values = [];
		            data.forEach(function(d) {
		            	if (d.tripDuration > 0 && d.tripDuration < 600) {
			                values.push(d.tripDuration);
			            }
		            }); 
		        	callback(null, values); 
		        }
			});
		}, name); 
		console.log("metric ", metric);
	    return metric;
	}


    function draw_graph(data_list) {
        d3.select("#demo")                 // Select the div on which we want to act           
          .selectAll(".axis")              // This is a standard D3 mechanism to
          .data(["top"])                   // bind data to a graph. In this case
          .enter()                         // we're binding the axes "top" and "bottom".
          .append("div")                   // Create two divs and 
          .attr("class", function(d) {     // give them the classes
            return d + " axis";            // top axis and bottom axis
          })                               // respectively 
          .each(function(d) {              // For each of these axes,
            d3.select(this)                // draw the axes with 4 intervals
              .call(context.axis()         // and place them in their proper places
              .ticks(16).orient(d)); 
          });


        d3.select("#demo")                 
          .selectAll(".horizon")           
          .data(data_list.map(getMetric))    
          .enter()                         
          .insert("div", ".bottom")        // Insert the graph in a div  
          .attr("class", "horizon")        // Turn the div into
          .call(context.horizon()          // a horizon graph
          .format(d3.format("d"))   // Format the values to 2 floating-point decimals
          // .format(d3.time.format("%Y-%m-%d %X"))
          .height(200))

        context.on("focus", function(i) {
            d3.selectAll(".value").style("right",                  // Make the rule coincide 
                i == null ? null : context.size() - i + "px"); // with the mouse
        });
    } 

      function drawCharts(data) {
      	var cf = crossfilter(data);

    	var all = cf.groupAll();

    	var dimensions = {}
		// dimension by hour
		dimensions["hour"] = cf.dimension(function (d) {
	        return d.Start;
	    });
	    // maintain data by hours as filters are applied or removed
    	var hourlyGroup = dimensions["hour"].group().reduce(
        function (p, v) {
            ++p.count;
            p.sumTripDuration += v.tripDuration
            p.avgTripDuration = p.sumTripDuration / p.count;
            return p;
        },
        /* callback for when data is removed from the current filter results */
        function (p, v) {
            --p.count;
            p.sumTripDuration -= v.tripDuration;
            p.avgTripDuration = p.sumTripDuration / p.count;
            return p;
        },
        /* initialize p */
        function () {
            return {count: 0, sumTripDuration: 0, avgTripDuration: 0 };
        });

    	var xMin = dimensions["hour"].top(1)[0].Start
    	var xMax = dimensions["hour"].bottom(1)[0].Start
        createBarChart(charts["tripsLength"], dimensions["hour"], hourlyGroup, xMin, xMax);
	}

    function createBarChart(chart, dimension, group, xMin, xMax) {
    	 //#### Bar Chart
    // Create a bar chart and use the given css selector as anchor. You can also specify
    // an optional chart group for this chart to be scoped within. When a chart belongs
    // to a specific group then any interaction with such chart will only trigger redraw
    // on other charts within the same chart group.
    /* dc.barChart("#volume-month-chart") */
    chart.width(1000)
        .height(180)
        .margins({top: 10, right: 50, bottom: 30, left: 40})
        .dimension(dimension)
        .group(group)
        .elasticY(true)
        // (optional) whether bar should be center to its x value. Not needed for ordinal chart, :default=false
        .centerBar(true)
        // (optional) set gap between bars manually in px, :default=2
        .gap(1)
        // (optional) set filter brush rounding
        .round(dc.round.floor)
        .alwaysUseRounding(true)
        .x(d3.scale.linear().domain([xMin, xMax]))
        .renderHorizontalGridLines(true)
        // customize the filter displayed in the control span
        .filterPrinter(function (filters) {
            var filter = filters[0], s = "";
            s = numberFormat(filter[0]) + "% -> " + numberFormat(filter[1]) + "%";
            return s;
        });
        // Customize axis
	    chart.xAxis().tickFormat( function (v) { return new Date(v) ; });
	    chart.xAxis().ticks(4);
	    chart.yAxis().ticks(10);


    }

        // var vehicleDimension = cf.dimension(function(d) {
        //   d.speed = +d.speed;
        //   d.num_stops = +d.num_stops;
        //   return +d.node_id;
        // })
        // var vehicleGroup = vehicleDimension.group().reduceCount();
        // var groups = vehicleGroup.all();
        // var sum = 0;
        // for (var vehicle in groups) {
        //   sum += groups[vehicle].value
        // }
        // var average = (sum / groups.length).toFixed(2);
        // var stdDeviation = 0
        // for (var vehicle in groups) {
        //   deviation = Math.pow(groups[vehicle].value - average, 2)
        //   stdDeviation += deviation;
        // }
        // stdDeviation = Math.sqrt(stdDeviation / groups.length).toFixed(2)
        // // vehicleGroup.all().reduce(function(previousValue, currentValue) { return previousValue.sum + previousValue. });
        // // console.log("vehicleGroup", vehicleGroup.all(), "sum", sum, "avg", average)
        // d3.select("#stats").append("div").html("Total number of vehicles: " + groups.length);
        // d3.select("#stats").append("div").html("Average seconds traveled: " + average);
        // d3.select("#stats").append("div").html("Standard deviation: " + stdDeviation);
        // d3.select("#stats").append("div").html("Total seconds traveled: " + sum);

        // var cf2 = crossfilter(groups)
        // var hist = cf2.dimension(function(d) { return d.value})
        // var count = hist.group();

        // var numBins = 30;
        // var binWidth = (count.all().length) / numBins;
        // // console.log("binWidth", binWidth)
        // var count = hist.group(function(d) {return Math.floor(d / binWidth) * binWidth;});
        // drawHistogram("#hist-vehicles", "Trip duration", "Number of vehicles", hist, count, numBins, binWidth)
            
        // d3.select(".data-status").style("display", "none")
      
      function drawTimeseriesCharts(cf) {
            // var timeDimension = cf.dimension(function(d) {
            //   d.speed = +d.speed;
            //   d.num_stops = +d.num_stops;
            //   return +d.step;
            // })

            // var metric = "num_stops";
            // var groupSize = 1;
            // // function(step) { return Math.floor(step / 10); }
            // // var timeGroup = timeDimension.group(function(step) { return Math.floor(step / groupSize); }).reduce(
            // var timeGroup = timeDimension.group().reduce(
            //   function(p,v) { // add
            //     ++p.count;
            //     if (v.num_stops > 1) {
            //       ++p.stops_count
            //     }
            //     p.speed_sum += v.speed
            //     p.speed_avg = p.speed_sum / p.count;
            
            //     return p;
            //   },
            //   function(p,v) { // remove
            //     --p.count;
            //     if (v[metric] > 0) {
            //       --p.stops_count
            //     }
            //     p.speed_sum -= v.speed_sum;
            //     p.speed_avg = p.speed_sum / p.count;
            //     return p;
            //   },
            //   function() { // init
            //     return { count: 0, speed_sum: 0, speed_avg: 0, stops_count: 0 };
            //   }
            // )

            // var steps = timeGroup.all();
            // for (var step in steps) {
            //   vehicles[step] = timeDimension.filter(step).top(Infinity)
            // }
            // timeDimension.filter(null);

            // updateXScale("x");
            // updateYScale("y");
            // step = firstStep;
            // showVehicles(vehicles[step])

            // drawChart("#num-vehicles", "Step", "Number of vehicles", timeDimension, timeGroup, "step", "count", groupSize)
            // drawChart("#num-stops", "Step", "Number of congestion reports", timeDimension, timeGroup, "step", "stops_count", groupSize)
            
      }
      function drawHistogram(selection, xLabel, yLabel, dimension, group, nBins, binWidth) {
        // counts = group.all();
        // var xMin = counts[0].key
        // var xMax = counts[counts.length-1].key;
        // var chart = dc.barChart(selection);
        // chart
        //   .height(160)
        //   .x(d3.scale.linear().domain([xMin,xMax]))
        //   .title(function(p) {
        //       return 
        //           "Number of vehicles: " + numberFormat(p.value) + "\n"
        //           + "that travel between : " + numberFormat(p.key) + " and " + numberFormat(p.key)+binWidth + "\n"
        //   })
        //   .renderTitle(true)
        //   .yAxisLabel(yLabel)
        //   .brushOn(false)
        //   // .dimension(dimension)
        //   .dimension(group)
        //   .keyAccessor(function(d) { return d.key; })
        //   .group(group)
        //   .valueAccessor(function (d) { return d.value; })
        //   .renderLabel(true)
        //   .transitionDuration(1500)
        //   .elasticY(true)
        //   // .xUnits(function(){return 1;});
        // chart.margins().left = 50;
        // chart.render();
        // // renderlet function
        // chart.renderlet(function(chart){
        //     // mix of dc API and d3 manipulation
        //     d3.select(".charts-status").style("display", "none");
        //     dc.events.trigger(function(){
        //       // focus some other chart to the range selected by user on this chart
        //       // someOtherChart.focus(chart.filter());
        //     });
        //     // moveChart.filter(chart.filter());
        // });
        // var tip = d3.tip()
        //   .attr('class', 'd3-tip')
        //   .offset([-10, 0])
        //   .html(function(d) {
        //     return "<strong>Frequency:</strong> <span style='color:red'>" + d.frequency + "</span>";
        //   })
        // tip = d3.tip().attr('class', 'd3-tip').html(function(d) { return d; });

        // /* Invoke the tip in the context of your visualization */
        // var histVis = d3.select("#hist-vehicles svg")
        // histVis.call(tip)
        // histVis.selectAll('.bar')
        //   .on('mouseover', tip.show)
        //   .on('mouseout', tip.hide)
      }

      function drawChart(selection, xLabel, yLabel, dimension, group, keyAccessor, valueAccessor, groupSize) {
        // var xMin = dimension.bottom(1)[0][keyAccessor]
        // var xMax = dimension.top(1)[0][keyAccessor];
        // var chart = dc.lineChart(selection);
        // chart
        //   // .width(580)
        //   .height(160)
        //   .x(d3.scale.linear().domain([xMin,xMax]))
        //   // .interpolate('step-before')
        //   .renderArea(false)
        //   .brushOn(false)
        //   // .renderDataPoints(false)
        //   .yAxisLabel(yLabel)
        //   .dimension(dimension)
        //   // .dimension(group)
        //   // .keyAccessor(function(d) { return d.key * groupSize; })
        //   .group(group)
        //   .valueAccessor(function (d) {
        //     return d.value[valueAccessor];
        //   })
        //   .renderTitle(true)
        //   .title(function(d){
        //     return "Step: " + d.key
        //     + "\n" + valueAccessor + ": " + d.value[valueAccessor];
        //     })
        //   // .title(function(p) {
        //   //     return 
        //   //         "Step: " + numberFormat(p[keyAccessor]) + "\n"
        //   //         + "Value : " + numberFormat(p.value[valueAccessor]) + "\n"
        //   // })
        //   .renderLabel(true)
        //   .transitionDuration(1500)
        //   .elasticY(true)

        // chart.margins().left = 50;
        // chart.render();
        // // renderlet function
        // chart.renderlet(function(chart){
        //     // mix of dc API and d3 manipulation
        //     d3.select(".charts-status").style("display", "none");
        //     dc.events.trigger(function(){
        //       // focus some other chart to the range selected by user on this chart
        //       // someOtherChart.focus(chart.filter());
        //     });
        //     // moveChart.filter(chart.filter());
        // });
      }
      $(window).resize(function(){
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