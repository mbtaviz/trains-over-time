window.drawMarey = function (stationNetwork, trips) {
  var margin = {top: 0, right: 10, bottom: 0, left: 60};
  var outerWidth = 600, outerHeight = 5500, legendOuterHeight = 90;
  var tinyMargin = {top: 0, right: 0, bottom: 0, left: 0};
  var tinyOuterWidth = 40, tinyOuterHeight = 300;
  var tinyWidth = tinyOuterWidth - tinyMargin.left - tinyMargin.right,
      tinyHeight = tinyOuterHeight - tinyMargin.top - tinyMargin.bottom;
  var width = outerWidth - margin.left - margin.right,
      height = outerHeight - margin.top - margin.bottom,
      legendHeight = legendOuterHeight;
  var header = window.header;
  var headerSvg = d3.select("#mareylegend").append('svg')
      .attr('width', outerWidth)
      .attr('height', legendOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',0)');
  var svg = d3.select('#marey').append('svg')
      .attr('width', outerWidth)
      .attr('height', outerHeight)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');
  var svgBackground = svg.append("g");
  var tinySvg = d3.select('#tinymarey').append('svg')
      .attr('class', 'tiny')
      .attr('width', tinyOuterWidth)
      .attr('height', tinyOuterHeight)
    .append('g')
      .attr('transform', 'translate(' + tinyMargin.left + ', ' + tinyMargin.top + ')');

  var xExtent = d3.extent(d3.values(header), function (d) { return d[0]; });
  var xScale = d3.scale.linear()
      .domain(xExtent)
      .range([0, width]);
  var tinyxScale = d3.scale.linear()
      .domain(xExtent)
      .range([0, tinyWidth]);
  var minUnixSeconds = d3.min(d3.values(trips), function (d) { return d.begin; });
  var maxUnixSeconds = d3.max(d3.values(trips), function (d) { return d.end; });
  var tinyyScale = d3.scale.linear()
    .domain([
      minUnixSeconds,
      maxUnixSeconds
    ]).range([0, tinyHeight]).clamp(true);
  var yScale = d3.scale.linear()
    .domain([
      minUnixSeconds,
      maxUnixSeconds
    ]).range([10, height]).clamp(true);
  var timeScale = d3.time.scale()
    .domain([new Date(minUnixSeconds * 1000), new Date(maxUnixSeconds * 1000)])
    .range([10, height]);
  var stationToName = {};
  var end = {};
  var nodesPerLine = stationNetwork.nodes.map(function (d) {
    return d.links.map(function (link) {
      var key = d.id + '|' + link.line;
      if (d.links.length === 1) { end[key] = true; }
      stationToName[key] = d.name;
      return key;
    });
  });
  nodesPerLine = _.unique(_.flatten(nodesPerLine));

  var keys = d3.keys(header);
  var stationXScale = d3.scale.ordinal()
      .domain(keys)
      .range(keys.map(function (d) { return xScale(header[d][0]); }));
  var stationXScaleInvert = {};
  keys.forEach(function (key) {
    stationXScaleInvert[header[key][0]] = key;
  });

  var stationLabels = headerSvg.selectAll('.station-label')
      .data(nodesPerLine)
      .enter()
    .append('text')
      .attr('class', 'station-label')
      .style('display', function (d) { return end[d] ? null : 'none'; })
      .attr('transform', function (d) { return 'translate(' + (stationXScale(d) - 2) + ',' + (legendHeight - 3) + ')rotate(70)'; })
      .style('text-anchor', 'end')
      .text(function (d) { return stationToName[d].replace(/ station/i, ''); });

  var stations = svg.selectAll('.station')
      .data(nodesPerLine)
      .enter()
    .append('line')
      .attr('class', function (d) { return 'station ' + d.replace('|', '-'); })
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

  // draw a dot at each train stop
  // TODO not sure if this is worth it?
  // svg.selectAll('.mareystop')
  //     .data(_.flatten(trips.map(function (trip) { return trip.stops.map(function (stop) { stop.line = trip.line; return stop; }); })))
  //     .enter()
  //   .append('circle')
  //     .attr('class', 'mareystop')
  //     .attr('r', 1)
  //     .attr('cx', function (stop) { return xScale(header[stop.stop + '|' + stop.line][0]); })
  //     .attr('cy', function (stop) { return yScale(stop.time); });

  // draw a line for each trip
  function draw(xScale, yScale) {
    return function (d) {
      var last = null;
      var stops = d.stops.map(function (stop) {
        // special case: place-jfk, place-nqncy -> place-jfk, place-asmnl (at same time), place-nqncy 
        // special case: place-nqncy, place-jfk -> place-nqncy, place-asmnl (at same time), place-jfk
        var result;
        if (last && last.stop === 'place-jfk' && stop.stop === 'place-nqncy') {
          result = [{stop: 'place-asmnl', time: last.time}, stop];
        } else if (last && last.stop === 'place-nqncy' && stop.stop === 'place-jfk') {
          result = [{stop: 'place-asmnl', time: stop.time}, stop];
        } else {
          result = [stop];
        }
        last = stop;
        return result;
      });
      var points = _.flatten(stops).map(function (stop) {
        var y = yScale(stop.time);
        var x = xScale(header[stop.stop + '|' + d.line][0]);
        return [x, y];
      });
      return lineMapping(points);
    };
  }

  window.highlightedTrip = null;
  window.hoveredTrip = null;

  window.highlightTrain = function (d) {
    highlightedTrip = d.trip;
    highlight();
    d3.event.stopPropagation();
  };

  window.unHoverTrain = function () {
    hoveredTrip = null;
    hover();
  };
  window.hoverTrain = function (d) {
    hoveredTrip = d.trip;
    hover();
  };

  svg.selectAll('.mareyline')
      .data(trips)
      .enter()
    .append('path')
      .attr('class', function (d) { return 'mareyline hoverable highlightable dimmable ' + d.line; })
      .attr('d', draw(xScale, yScale))
      .on('click', window.highlightTrain)
      .on('mouseover', window.hoverTrain)
      .on('mouseout', window.unHoverTrain);

  d3.select('body').on('click.highlightoff', function () { highlightedTrip = null; highlight(); });

  tinySvg.selectAll('.mareyline')
      .data(trips)
      .enter()
    .append('path')
      .attr('class', function (d) { return 'mareyline highlightable ' + d.line; })
      .attr('d', draw(tinyxScale, tinyyScale));

  d3.select("#marey").on('mousemove', selectTime);
  d3.select("#marey").on('scroll', setScrollBox);
  d3.select("#marey").on('mousemove.titles', updateTitle);
  d3.select("#tinymarey").on('click', setScroll);
  var barBackground = svgBackground.append('g').attr('class', 'g-bar');
  var barForeground = svg.append('g').attr('class', 'g-bar');
  barBackground.append('line')
      .attr('class', 'bar')
      .attr('x1', 1)
      .attr('x2', width)
      .attr('y1', 0)
      .attr('y2', 0);
  var tinyBar = tinySvg.append('g');
  tinyBar.append('line')
      .attr('class', 'bar')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', 0)
      .attr('y2', 0);
  barForeground.append('rect')
    .attr('class', 'text-background')
    .attr('x', 3)
    .attr('y', -14)
    .attr('width', 45)
    .attr('height', 12);
  var timeDisplay = barForeground.append('text')
    .attr('dx', 2)
    .attr('dy', -4);
  var bar = d3.selectAll("g.g-bar");

  function hover() {
    d3.selectAll('.hoverable')
      .classed('hover', function (d) { return d.trip === hoveredTrip; });
  }

  function highlight() {
    d3.select('body').classed('highlight-active', !!highlightedTrip);
    d3.selectAll('.highlightable')
      .classed('active', function (d) { return d.trip === highlightedTrip; });
  }

  window.highlightMareyTitle = function (title, lines) {
    var titles = {};
    titles[title] = true;
    if (lines) {
      lines.forEach(function (line) { titles[title + "|" + line] = true; });
    } else if (title) {
      titles[title] = true;
      titles[title.replace(/\|.*/, '')] = true;
    }
    stationLabels.style('display', function (d) {
      var display = end[d] || titles[d];
      return display ? null : 'none';
    });
    d3.selectAll('text.station-label').classed('active', function (d) {
      return titles[d.id ? d.id : d];
    });
  };

  function updateTitle() {
    var pos = d3.mouse(svg.node());
    var x = pos[0];
    var station = stationXScaleInvert[Math.round(xScale.invert(x))];
    window.highlightMareyTitle(station);
  }

  function selectTime() {
    var pos = d3.mouse(svg.node());
    var y = pos[1];
    var time = yScale.invert(y);
    select(time);
  }

  function select(time) {
    var y = yScale(time);
    bar.attr('transform', 'translate(0,' + y + ')');
    timeDisplay.text(moment(time * 1000).format('h:mm a'));
    var tinyY = tinyyScale(time);
    tinyBar.attr('transform', 'translate(0,' + tinyY + ')');
    window.render(time);
  }

  var scrollToTinyScale = d3.scale.linear()
      .domain([0, outerHeight])
      .range([0, tinyOuterHeight]);

  var scroll = tinySvg.append('rect')
      .attr('class', 'scroll')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', tinyOuterWidth)
      .attr('height', scrollToTinyScale(tinyOuterHeight));

  function setScrollBox() {
    var top = d3.select("#marey").node().scrollTop;
    scroll.attr('y', scrollToTinyScale(top));
  }

  function setScroll() {
    var pos = d3.mouse(tinySvg.node());
    var y = pos[1];
    var scrollPos = Math.max(scrollToTinyScale.invert(y) - tinyOuterHeight / 2, 0);
    d3.select("#marey").node().scrollTop = scrollPos;
    d3.event.stopPropagation();
  }

  select(minUnixSeconds);
  setScrollBox();

  svg.append('g')
    .attr('class', 'y axis')
    .call(yAxis);
};