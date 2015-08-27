// Revan Sopher 2014
var UI = require('ui');
var ajax = require('ajax');
var Vector2 = require('vector2');

// Make dummy request to wake up heroku
ajax(
	{
		url:'http://runextbus.herokuapp.com/config',
		type:'json'
	},
	function(data) {},
	function(error) {}
);

//parses /config
var parseRoutes = function(data) {
	var items = [];
	data['active']['routes'].forEach(function(route) {
		items.push({
			title:route['tag']
		});
	});
	return items;
};

//parses /route/$ROUTE
var parseStops = function(data) {
	var items = [];
	data.forEach(function(stop) {
		items.push({
			title:stop['title']
		});
	});
	return items;
};

//parses /stop/$STOP
var parseRoutesForStop = function(data) {
	var items = [];
	data.forEach(function(route) {
		if (route.predictions !== null) {
			items.push({
				title:route['title'],
				predictions:route['predictions']
			});
		}
	});
	
	return items;
};

// Gets menu items for location screen
var parseLocations = function(data) {
	var items = [];
	data.forEach(function(loc) {
		items.push({
			title:loc['location_name']
		});
	});
	
	return items;
};

var getNearestStop = function(data, lat, lon) {
	console.log("GEOLOCATION: " + lat + ", " + lon);
	var closestStop = null;
	var minDistance = Number.MAX_VALUE;
	
	for (var stop in data.stops) {
		if (data.stops.hasOwnProperty(stop)) {
			var latDiff = lat - parseFloat(data.stops[stop].lat);
			var lonDiff = lon - parseFloat(data.stops[stop].lon);
			var distSq = latDiff * latDiff + lonDiff * lonDiff;
			if (distSq < minDistance) {
				minDistance = distSq;
				closestStop = stop;
			}
		}
	}
	
	data.stops[closestStop].tag = closestStop;
	
	console.log("CLOSEST STOP: " + closestStop);
	return data.stops[closestStop];
};

var parseMeals = function(data, location) {
	var items = [];
	data[location]['meals'].forEach(function(meal) {
		items.push({
			title:meal['meal_name']
		});
	});
	return items;
};

var parseGenres = function(data, location, meal) {
	var items = [];
	data[location]['meals'][meal]['genres'].forEach(function(genre) {
		items.push({
			title:genre['genre_name']
		});
	});
	return items;
};

var parseItems = function(data, location, meal, genre) {
	var items = [];
	data[location]['meals'][meal]['genres'][genre]['items'].forEach(function(item) {
		items.push({
			title:item['name']
		});
	});
	return items;
};

// Show splash screen while waiting for data
var splashWindow = new UI.Window({
  backgroundColor:'red'
});

// Text element to inform user
var text = new UI.Text({
  position: new Vector2(0, 30),
  size: new Vector2(144, 40),
  text:'Downloading data...',
  font:'GOTHIC_28_BOLD',
  color:'black',
  textOverflow:'wrap',
  textAlign:'center'
});
splashWindow.add(text);

var mainMenu = new UI.Menu({
	highlightBackgroundColor: 'red',
	sections: [{
		title:'Rutgers University',
		items: [{
			title:'Dining'
		},{
			title:'Bus'
		}]
	}]
});
mainMenu.on('select', function(e) {
	if(e.itemIndex == 0) {
		//Dining
		splashWindow.show();

		// Make request
		ajax(
		  {
			url:'http://vps.rsopher.com/nutrition.json',
			type:'json'
		  },
		  function(data) {
			  var food_data = data;
			// Create an array of Menu items
			var locationItems = parseLocations(data);

			// Construct Menu to show to user
			var locationMenu = new UI.Menu({
			  highlightBackgroundColor: 'red',
			  sections: [{
				title: 'Locations',
				items: locationItems
			  }]
			});

			// Add an action for SELECT
			locationMenu.on('select', function(e) {
				//index of current location
				var curLoc = e.itemIndex;

				var mealItems = parseMeals(food_data, curLoc);

				var mealMenu = new UI.Menu({
					highlightBackgroundColor: 'red',
					sections: [{
						title: locationItems[curLoc].title,
						items: mealItems
					}]
				});

				mealMenu.on('select', function(e) {
					var curMeal = e.itemIndex;

					var genreItems = parseGenres(food_data, curLoc, curMeal);

					var genreMenu = new UI.Menu({
						highlightBackgroundColor: 'red',
						sections: [{
							title: mealItems[curMeal].title,
							items: genreItems
						}]
					});

					genreMenu.on('select', function(e) {
						var curGenre = e.itemIndex;

						var itemItems = parseItems(food_data, curLoc, curMeal, curGenre);

						var itemMenu = new UI.Menu({
							highlightBackgroundColor: 'red',
							sections: [{
								title: genreItems[curGenre].title,
								items: itemItems
							}]
						});

						itemMenu.on('select', function(e) {
							var item = food_data[curLoc]['meals'][curMeal]['genres'][curGenre]['items'][e.itemIndex];

							var detailCard = new UI.Card({
								title:item['name'],
								subtitle:item['calories'] + ' Cal',
								body:item['serving'],
								scrollable: true
							});
							detailCard.show();
						});

						itemMenu.show();
					});

					genreMenu.show();
				});

				mealMenu.show();
			});

			// Show the Menu, hide the splash
			locationMenu.show();
			splashWindow.hide();
		  },
		  function(error) {
			console.log("Download failed: " + error);
		  }
		);
	} else {
		//Bus
		splashWindow.show();

		// Make request for config.
		ajax(
		{
			url:'http://runextbus.herokuapp.com/config',
			type:'json'
		},
		function(data) {
			var routeItems = parseRoutes(data);  
			var routeMenu = new UI.Menu({
				highlightBackgroundColor: 'red',
				sections: [{
					title: '',
					items: [{title:'Nearest'}]
				},
				{
					title: 'Routes',
					items: routeItems
				}]
			});
			routeMenu.on('select', function(e) {
				if (e.sectionIndex === 0) {
					// get nearest
					splashWindow.show();
					navigator.geolocation.getCurrentPosition(
						function(pos) {
							var stop = getNearestStop(data, pos.coords.latitude, pos.coords.longitude);
							// have nearest, now get and show all its routes
							ajax(
								{
									url:'http://runextbus.herokuapp.com/stop/'+stop.tag,
									type:'json'
								},
								function(data) {
									splashWindow.hide();
									
									var routes = parseRoutesForStop(data);

									var routeForStopMenu = new UI.Menu({
										highlightBackgroundColor: 'red',
										sections: [{
											title: stop.title,
											items: routes
										}]
									});
									
									routeForStopMenu.on('select', function(e) {
										var route = routes[e.itemIndex];
										var body = "";
										route.predictions.forEach(function(pred) {
											body += pred.minutes + 'min\n';
										});
										var stopCard = new UI.Card({
											title:stop.title + ": " + route.title,
											body:body
										});
										stopCard.show();
									});
									
									routeForStopMenu.show();
								},
								function(error) {
									console.log("Download failed: " + error);
									splashWindow.hide();
								}
							);
						},
						function(err) {
							splashWindow.hide();
						},
						{
							enableHighAccuracy: true, 
							maximumAge: 10000, 
							timeout: 10000
						}
					);
				} else {
					// picking a route
					var tag = data['active']['routes'][e.itemIndex]['tag'];
					ajax(
						{
							url:'http://runextbus.herokuapp.com/route/'+tag,
							type:'json'
						},
						function(data) {
							var stops = data;
							var stopItems = parseStops(data)
							var stopMenu = new UI.Menu({
								highlightBackgroundColor: 'red',
								sections: [{
									title: 'Stops: ' + tag,
									items: stopItems
								}]
							});
							stopMenu.on('select', function(e) {
								var stop = stops[e.itemIndex];
								var body = "";
								stop['predictions'].forEach(function(pred) {
									body += pred['minutes'] + 'min\n';
								});
								var stopCard = new UI.Card({
									title:stop['title'] + ": " + tag,
									body:body
								});
								stopCard.show();
							});
							stopMenu.show();
						},
						function(error) {
							console.log("Download failed: " + error);
						}
					);
				}
			});
			
			// Show the Menu, hide the splash
			splashWindow.hide();
			routeMenu.show();
		},
		function(error) {
			console.log("Download failed: " + error);
		});
	}
});
mainMenu.show();