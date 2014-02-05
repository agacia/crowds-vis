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
        
        , dateLabel = $("<div/>")
                    .css({ position : 'absolute' , top : 0, left : 0 })
                    .text(step)
        , timer
        , timerDelay = 300
        , charts = {}

        if ( window.self !== window.top ){
        // we're in an iframe! oh no! hide the twitter follow button
        }

        init();

        function init() {
            $(".clock").append(dateLabel);
            $('.loader').show()
            queue()
              .defer(d3.csv, rootUrl + scenario + "/Miami-Trips-JuneJuly2013-short.csv")
              .await(onDataLoaded);
        }

        function onDataLoaded(data, error) {
          // console.log("downloaded data" , error, data)
          $('.loader').hide();
          if(error) {
            $('.error').html("No data for " + scenario);
          }
          else {
            $('.error').html("");
            createSedimentation(data, "#sedimentation-trips"); 
          }
        }

        function createSedimentation(data, selector) {
          createBubbleChart(data, selector)
        }

        function createBubbleChart(data, selector) {
          mySettings = {
              width:800,
              height:800,
              data:{
                    model:
                          [
                            {label:"Column A"},
                            {label:"Column B"},
                            {label:"Column C"},
                          ],
                    strata:[
                             [{initValue: 10, label: "Strata 1 col A"}],
                             [{initValue: 5, label: "Strata 1 col B"}],
                             [{initValue: 20, label: "Strata 2 col C"}]      
                            ],
                    stream:{
                      provider:'generator',
                      refresh:1000/6
                    }
                  },
              sedimentation:{
                token:{
                  size:{original:5,minimum:3}
                },
                suspension:{
                  decay:{power:1.02}
                }
              },
              chart:{
                     type:'CircleLayout',
                     spacer:2,
                     radius:50,
                     x:100,
                     y:200,
                     width:300,
                     height:300,
                    },
              options:{
                layout:false,
               // debugaggregate:true
              }
            }

          // Difference between a Bubble chart and a piechart settings model 
          mySettings.chart.treeLayout = true
          mySettings.chart.spacer     = 100
          mySettings.chart.column     = 3
          mySettings.options.layout   = false

          var myBubbleChart = $(selector).vs(mySettings).data('visualSedimentation');

          // Change the default token incomming point 
          myBubbleChart.settings.sedimentation.incoming.point[2]={x:250,y:50}
          myBubbleChart.settings.sedimentation.incoming.point[1]={x:240,y:50}
          myBubbleChart.settings.sedimentation.incoming.point[0]={x:230,y:50}
        }

        function createHeapChart(data, selector) {
          mySettings = {
              width:600,
              height:300,
              chart:{
                  type:"heapchart"
              },
              data:{
                    "model":
                            [
                              {label:"Column A"},
                              {label:"Column B"},
                              {label:"Column C"},
                            ],
                    "strata":[
                              [
                                {value: 10, label: "Strata 1 col A"},
                                {value: 15, label: "Strata 2 col A"},
                                {value: 10, label: "Strata 3 col A"}
                              ],[
                                {value: 55, label: "Strata 1 col B"},
                                {value: 5, label: "Strata 2 col B"},
                              ],[
                                {value: 20, label: "Strata 2 col C"}
                              ]      
                            ],
                    stream:{provider:'generator',refresh:10000/6}
                  },
              sedimentation:{
                token:{
                  size:{original:15,minimum:3}
                },
                suspension:{
                  decay:{power:1.01}
                }
              },
              options:{
                layout:false,
                debugaggregate:true,
              }
            }
          var heatchart = $(selector).vs(mySettings).data('visualSedimentation');
        }


        function onStepUpdated() {
            dateLabel.text(step);      
        }

        function loadFile(url, cb) {
            $('.loader').show()
            d3.tsv(url, format, function(err, data){
              if(err) {
                $('.error').html("No data for " + scenario + " " + url);
              }
              else {
                cb(data);
              }
            })
        }


      $(window).resize(function(){
      });

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
      function getDistanceAndDurationGoogle() {
        var origin1 = new google.maps.LatLng(55.930385, -3.118425);
        var origin2 = "Greenwich, England";
        var destinationA = "Stockholm, Sweden";
        var destinationB = new google.maps.LatLng(50.087692, 14.421150);

        var service = new google.maps.DistanceMatrixService();
        console.log("service", service)
        service.getDistanceMatrix(
          {
            origins: [origin1, origin2],
            destinations: [destinationA, destinationB],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL, // METRIC
            durationInTraffic: true,
            avoidHighways: false,
            avoidTolls: false
          }, callback);

        function callback(response, status) {
          // See Parsing the Results for
          // the basics of a callback function.
          console.log("reposne", response, "status", status)
        }
      }

    }