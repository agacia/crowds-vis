function traffic() {
	var mapItem
	, center = { "lat": 34.1326, "lng": -117.9338}
	, zoom = 11;

	function map() {
	}

	map.initializeMap = function() {
		console.log("initialize map")
		mapItem = new L.Map("map_item");
		var layer = new L.StamenTileLayer("toner-lite");
		mapItem.addLayer(layer);
		mapItem.setView(new L.LatLng(center.lat, center.lng), zoom); 
		// // ad d3 svg overlay
		// this.initializePathsOverlay();
		// this.initializeSensorsOverlay();
	}
	return map;
}

window.onload = function() {
	console.log("traffic onload");

	var t = traffic();
	t.initializeMap();
}

