//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["Males", "Females", "Age Under 5", "Age Between 5-9", "Age Between 10-14", "Age Between 15-19", "Age Between 20-24", "Age Between 25-34", "Age Between 35-44", "Age Between 45-54", "Age Between 55-64", "Age Between 65-74", "Age Between 75-84", "Age 85 and Up", "Median Age", "Median Age Males", "Median Age Females"]; //list of attributes
var expressed = attrArray[0]; //initial attribute
    
//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scale.linear()
    .range([300, 0])
    .domain([0, 70]);    

//begin script when window loads
window.onload = setMap();
    
    
//set up choropleth map
function setMap(){
    
    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = window.innerHeight * 0.95;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height)
        .call(d3.behavior.zoom().on("zoom", function () {
        map.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
        }))
        .append("g");

    //create Albers equal area conic projection centered on US
    
    var projection = d3.geo.albers()
        .center([-1.64, 38.78])        
        .parallels([29.5, 45.5])
        .scale(800)
        .translate([width / 2, height / 2]);
    
    
    var path = d3.geo.path()
        .projection(projection);
    
    var g = map.append("g");

    
    //use queue to parallelize asynchronous data loading
    d3_queue.queue()
        .defer(d3.csv, "data/Final.csv") //load attributes from csv
        .defer(d3.json, "data/OtherAmerica.topojson") //load background spatial data
        .defer(d3.json, "data/States.topojson") //load spatial data
        .await(callback);
    
    function callback(error, csvData, north, usa){
        
        setGraticule(map, path);

        //translate North American and USA TopoJSONs
        var northCountries = topojson.feature(north, north.objects.OtherAmerica), 
        usStates = topojson.feature(usa, usa.objects.Lean_States).features;

        //add North American countries to map
        var countries = map.append("path")
            .datum(northCountries)
            .attr("class", "countries")
            .attr("d", path)
            .style("fill", "#cccccc")
            

        //join csv data to GeoJSON enumeration units
        usStates = joinData(usStates, csvData);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(usStates, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        createDropdown(csvData);
    };
}; //end of setMap()
 
    
function setGraticule(map, path){
    //...GRATICULE BLOCKS FROM PREVIOUS MODULE
    var graticule = d3.geo.graticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude
      //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

     
function joinData(usStates, csvData){
    //...DATA JOIN LOOPS FROM EXAMPLE 1.1
    for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            var csvKey = csvRegion.STATE_FIPS; //the CSV primary key

            //loop through geojson regions to find correct region
            for (var a=0; a<usStates.length; a++){

                var geojsonProps = usStates[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.STATE_FIPS; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };

    return usStates;
};
        



function setEnumerationUnits(usStates, map, path, colorScale){
    //...REGIONS BLOCK FROM PREVIOUS MODULE
     //add US regions to map
    var regions = map.selectAll(".regions")
        .data(usStates)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.STATE_FIPS;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
    var desc = regions.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};



    
//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#f0f9e8",
        "#b2e2e2",
        "#66c2a4",
        "#2ca25f",
        "#006d2c"
    ];

    //create color scale generator
    var colorScale = d3.scale.quantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};
    
//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
    

    
function setChart(csvData, colorScale){
 
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);


    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.STATE_FIPS;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
    
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
        updateChart(bars, csvData.length, colorScale);
 //end of setChart()
        

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", innerWidth * 0.16)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(expressed);

    //create vertical axis generator
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left");

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight * 0.655)
        .attr("transform", translate);
    
};
    
    
//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });
        

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};
    
//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var regions = d3.selectAll(".regions")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
     var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
}; //end of changeAttribute()

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
    var chartTitle = d3.select(".chartTitle")
        .text(expressed);
};
    
 //function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.STATE_FIPS)
        .style("stroke", "red")
        .style("stroke-width", "5");
    setLabel(props);
};
    
 //function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.STATE_FIPS)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
     d3.select(".infolabel")
        .remove();
};
     
     
//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] + "%" +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.STATE_NAME);
};
    
//function to move info label with mouse
function moveLabel(){
     //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};   

    
})(); //last line of main.js

