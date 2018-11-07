var map, searchManager, infobox;
var layerWard, layerPollLocations, layerPollBoundaries;

var wardBoundaries, pollLocations, pollBoundaries;
var results_2018, results_2014;

function GetMap() {
    map = new Microsoft.Maps.Map('#myMap', {
        zoom: 10
    });

    //Create an infobox at the center of the map but don't show it.
    infobox = new Microsoft.Maps.Infobox(map.getCenter(), {
        visible: false
    });

    //Assign the infobox to a map instance.
    infobox.setMap(map);

    // Load the search/autosuggest modules
    Microsoft.Maps.loadModule(['Microsoft.Maps.AutoSuggest', 'Microsoft.Maps.Search'], function() {
        var manager = new Microsoft.Maps.AutosuggestManager({ map: map });
        manager.attachAutosuggest('#search', '#searchContainer', suggestionSelected);
        searchManager = new Microsoft.Maps.Search.SearchManager(map);
    });

    //Load the GeoJson Module.
    Microsoft.Maps.loadModule('Microsoft.Maps.GeoJson', function() {
        layerWard = new Microsoft.Maps.Layer();
        layerPollBoundaries = new Microsoft.Maps.Layer();
        layerPollLocations = new Microsoft.Maps.Layer();

        // Load poll boundaries into layer for manipulation
        for (var i = 0; i < pollBoundaries.features.length; i++) {
            var shape = Microsoft.Maps.GeoJson.read(pollBoundaries.features[i].geometry);

            shape.metadata = {
                poll: pollBoundaries.features[i].properties.POLL,
                poll_type: pollBoundaries.features[i].properties.POLL_TYPE,
                ward: pollBoundaries.features[i].properties.WARD
            };

            layerPollBoundaries.add(shape);
        }

        for (var i = 0; i < pollLocations.features.length; i++) {
            var pushpin = Microsoft.Maps.GeoJson.read(pollLocations.features[i].geometry, {
                pushpinOptions: {
                    visible: false
                }
            });

            pushpin.metadata = {
                id: pollLocations.features[i].properties.OBJECTID,
                name: pollLocations.features[i].properties.NAME,
                address: pollLocations.features[i].properties.ADDRESS,
                poll: pollLocations.features[i].properties.POLL,
                poll_type: pollLocations.features[i].properties.POLL_TYPE,
                ward: pollLocations.features[i].properties.WARD
            };

            layerPollLocations.add(pushpin);
        }

        //Parse the Ward boundaries object into a Bing Maps shape.
        for (var i = 0; i < wardBoundaries.features.length; i++) {
            var shape = Microsoft.Maps.GeoJson.read(wardBoundaries.features[i].geometry, {
                polygonOptions: {
                    fillColor: 'rgba(255,0,0,0.5)',
                    strokeColor: 'white',
                    strokeThickness: 2
                }
            });

            // Add label to ward
            addPolygonWithLabel(shape, 'Ward ' + wardBoundaries.features[i].properties.WARD);

            shape.metadata = {
                ward: wardBoundaries.features[i].properties.WARD
            };

            layerWard.add(shape);
        }

        // Add the wards layer to the map.
        map.layers.insert(layerWard);

        map.layers.insert(layerPollLocations);


        // Add click event to the layer.
        Microsoft.Maps.Events.addHandler(layerWard, 'click', wardClicked);
        Microsoft.Maps.Events.addHandler(layerPollLocations, 'click', pollLocationClicked);
    });
}

function addPolygonWithLabel(polygon, label) {
    //Load the Spatial Math module.
    Microsoft.Maps.loadModule("Microsoft.Maps.SpatialMath", function() {
        //Calculate the centroid of the polygon.
        var centroid = Microsoft.Maps.SpatialMath.Geometry.centroid(polygon);

        //Create a pushpin that has a transparent icon and a title property set to the label value.
        var labelPin = new Microsoft.Maps.Pushpin(centroid, {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
            title: label
        });
        //Store a reference to the label pushpin in the polygon metadata.
        polygon.label = { label: labelPin };
        //Add the label pushpin to the map.
        map.entities.push(labelPin);
    });

}

function wardClicked(e) {
    if (e) {
        changeSelectedColor(e.primitive);
        loadWardData(e.primitive.metadata.ward);
    }
}

function pollLocationClicked(e) {
    //Make sure the infobox has metadata to display.
    if (e.target.metadata) {
        //Set the infobox options with the metadata of the pushpin.
        infobox.setOptions({
            location: e.target.getLocation(),
            title: e.target.metadata.name,
            description: e.target.metadata.address,
            visible: true
        });
    }
}

function changeSelectedColor(selectedPolygon) {
    var polygons = layerWard.getPrimitives();
    // reset all polygon colours to default
    polygons.forEach(polygon => {
        polygon.setOptions({
            fillColor: 'rgba(255,0,0,0.5)',
        });
    });

    selectedPolygon.setOptions({
        fillColor: 'rgba(0,0,255,0.3)',
    });
}

function suggestionSelected(result) {
    calculatePollBoundary(result.location.latitude, result.location.longitude);
}

function calculatePollBoundary(lat, long) {
    var userLocation = new Microsoft.Maps.Location(lat, long);

    var boundaries = layerPollBoundaries.getPrimitives();

    boundaries.forEach(pollBoundary => {
        // Check if the user location is in any of the ward boundaries
        if (Microsoft.Maps.SpatialMath.Geometry.intersects(userLocation, pollBoundary)) {
            // Change the color of the ward that the user is located in
            changeSelectedColor(layerWard.getPrimitives().filter(ward => ward.metadata.ward == pollBoundary.metadata.ward)[0]);
            loadWardData(pollBoundary.metadata.ward, pollBoundary);
        } else {
            // User is not located in a ward, give error message
        }
    });
}

function loadWardData(ward, polls = null) {
    $("#wardTitle").html("Ward " + ward + " Details");

    // Construct table with results data
    constructResultsTable("#results-2018", results_2018, ward);
    constructResultsTable("#results-2014", results_2014, ward);
    constructPolls(ward, polls);
}

function constructResultsTable(baseId, results, ward) {
    // Filter results to current ward and sort descending
    results = results.candidates.filter(candidate => candidate.ward == ward).sort((a, b) => b.vote_count - a.vote_count);

    var candidates = '';
    // Loop through, create a table row with ID
    // DOM manipulation is heavy, better to create the HTML all at once and manipulate it once than looping during manipulation
    results.forEach((candidate, i) => {
        // As the data is already sorted the first row is always the winner
        candidates += (i == 0 ? '<tr class="success">' : '<tr>') + '<td>' + candidate.name + '</td><td>' + candidate.vote_count + '</td></tr>';
    })

    $(baseId)
        .html(
            // Outer table div
            $("<div>")
            .attr('class', 'table-responsive')
            .append(
                // Table
                $("<table>")
                .attr('class', 'table table-bordered')
                // Table head
                .append(
                    $("<thead>")
                    // Table head contents
                    .append(
                        $("<tr>")
                        .append(
                            $("<th>").text("Name"),
                            $("<th>").text("Vote Count")
                        )
                    )
                )
                // Table body
                .append(
                    $("<tbody>")
                    // Table body contents
                    .append(candidates)
                )
            )
        );
}

function constructPolls(ward, polls) {
    var locations =
        polls == null ?
        pollLocations.features.filter(poll => poll.properties.WARD == ward) :
        pollLocations.features.filter(poll => poll.properties.POLL == polls.metadata.poll && poll.properties.WARD == polls.metadata.ward);

    var pollData = '';

    // Reset visible pushpins to false
    layerPollLocations.getPrimitives().filter(layerPoll => layerPoll.getVisible() == true).forEach(pushpinPoll => {
        pushpinPoll.setOptions({
            visible: false
        });
    });

    locations.forEach(location => {
        // Set all pushpins for ward to be visible or the one location to be visible
        layerPollLocations.getPrimitives().filter(layerPolls => layerPolls.metadata.id == location.properties.OBJECTID).forEach(pollLocation => {
            pollLocation.setOptions({
                visible: true
            });
        });

        pollData += '<tr><td><address><strong>' + location.properties.NAME + '</strong><br>' + location.properties.ADDRESS + '<br>Poll Type: ' + location.properties.POLL_TYPE + '</address></td></tr>';
    });

    $("#pollInformation")
        .html(
            // Outer table div
            $("<div>")
            .attr('class', 'table-responsive')
            .append(
                // Table
                $("<table>")
                .attr('class', 'table table-bordered')
                // Table body
                .append(
                    $("<tbody>")
                    // Table body contents
                    .append(pollData)
                )
            )
        );
    var text = polls == null ? "<h2>All Ward " + ward + " Poll Locations</h2>" : "<h2>Your Polling Location<h2>";
    $(text).prependTo("#pollInformation");
}

$(document).ready(function() {
    // Load ward boundaries
    $.getJSON("https://opendata.arcgis.com/datasets/8b0b1f2bf8bb4e1da3a1bf567b17b77f_7.geojson", function(data) {
        wardBoundaries = data;
    });

    // Load poll locations
    $.getJSON("https://opendata.arcgis.com/datasets/8d2dbcc55cac4a409cdb0d9cbaefba28_1.geojson", function(data) {
        pollLocations = data;
    });

    // Load poll boundaries
    $.getJSON("https://opendata.arcgis.com/datasets/38d1fe05b9cc47b994a83e38b33f26b4_0.geojson", function(data) {
        pollBoundaries = data;
    });

    // Load 2018 election results
    $.getJSON("results-2018.json", function(data) {
        results_2018 = data;
        // Load mayoral results on page load
        constructResultsTable("#results-2018", results_2018, 0);
    });

    // Load 2014 election results
    $.getJSON("results-2014.json", function(data) {
        results_2014 = data;
        // Load mayoral results on page load
        constructResultsTable("#results-2014", results_2014, 0);
    });

    $("#wardTitle").html("Mayoral Race Results");
});