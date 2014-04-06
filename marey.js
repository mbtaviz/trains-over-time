window.drawMarey = function (stationNetwork, trips) {
  var margin = {top: 20, right: 10, bottom: 10, left: 60};
  var outerWidth = 600, outerHeight = 5500;
  var width = outerWidth - margin.left - margin.right,
      height = outerHeight - margin.top - margin.bottom;
  var header = window.header;
  var svg = d3.select('#marey').append('svg')
      .attr('width', outerWidth)
      .attr('height', outerHeight)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

  var positions = d3.values(header);
  var xExtent = d3.extent(positions, function (d) { return d[0]; });
  var xScale = d3.scale.linear()
      .domain(xExtent)
      .range([0, width]);
  var minUnixSeconds = d3.min(d3.values(trips), function (d) { return d.begin; });
  var maxUnixSeconds = d3.max(d3.values(trips), function (d) { return d.end; });
  var yScale = d3.scale.linear()
    .domain([
      minUnixSeconds,
      maxUnixSeconds
    ]).range([0, height]);
  var timeScale = d3.time.scale()
    .domain([new Date(minUnixSeconds * 1000), new Date(maxUnixSeconds * 1000)])
    .range([0, height]);
  var nodesPerLine = stationNetwork.nodes.map(function (d) {
    return d.links.map(function (link) {
      return d.id + '|' + link.line;
    });
  });
  nodesPerLine = _.unique(_.flatten(nodesPerLine));

  var stations = svg.selectAll('.station')
      .data(nodesPerLine)
      .enter()
    .append('line')
      .attr('class', 'station')
      .attr('x1', function (d) { return xScale(header[d][0]); })
      .attr('x2', function (d) { return xScale(header[d][0]); })
      .attr('y1', 0)
      .attr('y2', height);
  var timeFmt = d3.time.format("%0I:%M %p");
  var yAxis = d3.svg.axis()
    .tickFormat(timeFmt)
    .ticks(d3.time.minute, 15)
    .scale(timeScale)
    .orient("left");

  // data is:
  // [
  //   {
  //     "trip": "B98A378CB",
  //     "begin": 1391577320,
  //     "end": 1391578396,
  //     "line": "blue",
  //     "stops": [
  //       {
  //         "stop": "place-wondl",
  //         "time": 1391577320
  //       },
  //       ...
  //     ]
  //   },
  //   ...
  // ]

  var lineMapping = d3.svg.line()
    .x(function(d) { return d[0]; })
    .y(function(d) { return d[1]; })
    .interpolate("linear");

  svg.selectAll('.mareyline')
      .data(trips)
      .enter()
    .append('path')
      .attr('class', function (d) { return 'mareyline ' + d.line; })
      .attr('d', function (d) {
        var stops = d.stops;
        var points = stops.map(function (stop) {
          var y = yScale(stop.time);
          var x = xScale(header[stop.stop + '|' + d.line][0]);
          return [x, y];
        });
        return lineMapping(points);
      });

  d3.select("#marey").on('mousemove', selectTime);
  d3.select("#marey").on('mouesover', selectTime);
  var bar = svg.append('g');
  bar.append('line')
      .attr('class', 'bar')
      .attr('x1', 1)
      .attr('x2', width)
      .attr('y1', 0)
      .attr('y2', 0);
  var timeDisplay = bar.append('text')
    .attr('dx', 2)
    .attr('dy', -2);


  function selectTime() {
    var pos = d3.mouse(svg.node());
    var y = pos[1];
    var time = yScale.invert(y);
    select(time);
  }

  function select(time) {
    var y = yScale(time);
    bar.attr('y1', y).attr('y2', y);
    bar.attr('transform', 'translate(0,' + y + ')');
    timeDisplay.text(moment(time * 1000).format('h:mm a'));
    window.render(time);
  }

  select(minUnixSeconds);

  svg.append('g')
    .attr('class', 'y axis')
    .call(yAxis);
};