function InfoTooltip() {
	var width = 400,
		animation = 600
		selection = null
	
	function tooltip(sel) {
		selection = sel;
		$(selection).draggable({handle: ".title"}); 
		$(selection + " .close").click(function(e) {
          $(selection).hide(animation);
        });
        $(".project-info-icon").click(function(e) {
        	$(selection).show(animation);
        })
	}

	tooltip.show = function() {
		$(selection).show(animation);
	}
	tooltip.hide = function() {
		$(selection).hide(animation);
	}

	return tooltip;
}