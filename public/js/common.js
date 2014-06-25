


function Player() {
  var timer
    , step
    , firstStep
    , lastStep
    , timerDelay
    , onStepCb
    , slider;

    function test() {
      console.log("test")
    }

  
    return {
      play: function() {
        if (this.step < this.lastStep) {
          this.step += this.stepSize;
        }
        else {
          this.step = this.firstStep;
        }
        this.onStepCb();
        this.slider.slider({value : this.step });
        this.dateLabel.text(this.formatStep(this.step));
        var that = this;
        this.timer = setTimeout(function() {  
            that.play();
          }, this.timerDelay);
      },
      pause: function() {
        if (this.timer) {
          clearTimeout(this.timer);
          timer = 0
        }
      },
      togglePlay: function(){
        var $elem = $('.player').children(':first');
        $elem.stop()
          .show()
          .animate({'marginTop':'-175px','marginLeft':'-175px','width':'350px','height':'350px','opacity':'0'},function(){
            $(this).css({'width':'100px','height':'100px','margin-left':'-50px','margin-top':'-50px','opacity':'1','display':'none'});
          });
        $elem.parent().append($elem);
      },
      init : function(firstStep, lastStep, stepSize, stepOffset, timerDelay, onStepCb) {
        this.firstStep = firstStep;
        this.lastStep = lastStep;
        this.stepSize = stepSize;
        this.stepOffset = stepOffset;
        this.timerDelay = timerDelay;
        this.onStepCb = onStepCb;

        test(); 
        var that = this;
        $('.playbutton').click(function(e){ 
          that.togglePlay();
          if ($(this).hasClass("play")) {
            $(this).addClass("pause");
            $(this).removeClass("play");
            that.play();
          }
          else {
            $(this).addClass("play");
            $(this).removeClass("pause");
            that.pause();
          }
          return false;
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
      },
      formatStep: function(step) {
        var seconds = step + this.stepsOffset;
        console.log("seconds", step, this.stepOffset)
        if ((this.lastStep - this.firstStep) > 120) {
         return (seconds/60).toFixed(2) + " min"
        }
        return seconds + " s"
      },
      initialiseSlider : function(callback) {
        

        this.dateLabel = $("<div/>")
            .css({ position : 'absolute' , top : 0, left : 0, width: "60px"})
            .text(this.formatStep(this.step))
        $(".slider").slider()
          .find(".ui-slider-handle")
          .append(this.dateLabel)
        this.slider = $( ".slider" ).slider({
          min: this.firstStep,
          max: this.lastStep,
          step: this.stepSize,
          value: this.firstStep,
          slide: function( event, ui ) { 
            this.step = ui.value; 
            this.dateLabel.text(this.formatStep(this.step));
          }
        });
      }
    }

}







