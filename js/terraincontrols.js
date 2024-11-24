function addSVG(div, id) {
    if (id === null) {
        id = 'svg' + (Math.random() * 1000);
    }
    return div.insert("svg")
        .attr("height", 800)
        .attr("width", 800)
        .attr("viewBox", "-500 -500 1000 1000")
        .attr('id', id);
}
var meshDiv = d3.select("div#mesh");
var meshSVG = addSVG(meshDiv);

var pointCount = 65536;
var meshPts = null;
var meshVxs = null;
var meshDual = false;

function meshDraw() {
    if (meshDual && !meshVxs) {
        meshVxs = makeMesh(meshPts).vxs;
    }
    visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
}

function setPointCount(){
    pointCount = d3.select("#gridPoints").property('value') !== '' ? d3.select("#gridPoints").property('value') : defaultParams.npts;
}

meshDiv.append("input")
    .attr('id', 'gridPoints')
    .attr('placeholder', 'Points (16384)')
    // .attr('value', 16384)
    .on("change", function () {
        setPointCount();
    });

meshDiv.append("button")
    .text("Generate map mesh")
    .on("click", function () {
        meshDual = false;
        meshVxs = null;
        // meshPts = generatePoints(16384);
        meshPts = generatePoints(pointCount);
        meshDraw();
    });

meshDiv.append("button")
    .text("Improve mesh")
    .on("click", function () {
        meshPts = improvePoints(meshPts);
        meshVxs = null;
        meshDraw();
    });

var vorBut = meshDiv.append("button")
    .text("Show Voronoi corners")
    .on("click", function () {
        meshDual = !meshDual;
        if (meshDual) {
            vorBut.text("Show original points");
        } else {
            vorBut.text("Show Voronoi corners");
        }
        meshDraw();
    });

var primDiv = d3.select("div#prim");
var primSVG = addSVG(primDiv);

var primH = zero(generateGoodMesh(4096));
// var primH = zero(generateGoodMesh(pointCount));

function primDraw() {
    visualizeVoronoi(primSVG, primH, -1, 1);
    drawPaths(primSVG, 'coast', contour(primH, 0));
}

primDraw();

primDiv.append("button")
    .text("Reset to flat")
    .on("click", function () {
        primH = zero(primH.mesh); 
        primDraw();
    });

primDiv.append("button")
    .text("Add random slope")
    .on("click", function () {
        primH = add(primH, slope(primH.mesh, randomVector(4)));
        primDraw();
    });

primDiv.append("button")
    .text("Add cone")
    .on("click", function () {
        primH = add(primH, cone(primH.mesh, -0.5));
        primDraw();
    });

primDiv.append("button")
    .text("Add inverted cone")
    .on("click", function () {
        primH = add(primH, cone(primH.mesh, 0.5));
        primDraw();
    });

primDiv.append("button")
    .text("Add 5 blobs")
    .on("click", function () {
        primH = add(primH, mountains(primH.mesh, 5));
        primDraw();
    });

primDiv.append("button")
    .text("Add 10 blobs")
    .on("click", function () {
        primH = add(primH, mountains(primH.mesh, 10));
        primDraw();
    });

primDiv.append("button")
    .text("Normalize heightmap")
    .on("click", function () {
        primH = normalize(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Round hills")
    .on("click", function () {
        primH = peaky(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Relax")
    .on("click", function () {
        primH = relax(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Set sea level to median")
    .on("click", function () {
        primH = setSeaLevel(primH, 0.5);
        primDraw();
    });

// Erosion

var erodeDiv = d3.select("div#erode");
var erodeSVG = addSVG(erodeDiv);

function generateUneroded() {
    var mesh = generateGoodMesh(4096);
    var h = add(slope(mesh, randomVector(4)),
                cone(mesh, runif(-1, 1)),
                mountains(mesh, 50));
    h = peaky(h);
    h = fillSinks(h);
    h = setSeaLevel(h, 0.5);
    return h;
}

var erodeH = primH;
var erodeViewErosion = false;

function erodeDraw() {
    if (erodeViewErosion) {
        visualizeVoronoi(erodeSVG, erosionRate(erodeH));
    } else {
        visualizeVoronoi(erodeSVG, erodeH, 0, 1);
    }
    drawPaths(erodeSVG, "coast", contour(erodeH, 0));
}

erodeDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        erodeH = generateUneroded();
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Copy heightmap from outline")
    .on("click", function () {
        erodeH = primH;
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Erode")
    .on("click", function () {
        erodeH = doErosion(erodeH, 0.1);
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Set sea level to median")
    .on("click", function () {
        erodeH = setSeaLevel(erodeH, 0.5);
        erodeDraw();
    });


erodeDiv.append("button")
    .text("Clean coastlines")
    .on("click", function () {
        erodeH = cleanCoast(erodeH, 1);
        erodeH = fillSinks(erodeH);
        erodeDraw();
    });

var erodeBut = erodeDiv.append("button")
    .text("Show erosion rate")
    .on("click", function () {
        erodeViewErosion = !erodeViewErosion;
        if (erodeViewErosion) {
            erodeBut.text("Show heightmap");
        } else {
            erodeBut.text("Show erosion rate");
        }
        erodeDraw();
    });

// Terrain

var physDiv = d3.select("div#phys");
var physSVG = addSVG(physDiv);
var physH = erodeH;

var physViewCoast = false;
var physViewRivers = false;
var physViewSlope = false;
var physViewHeight = true;

function physDraw() {
    if (physViewHeight) {
        visualizeVoronoi(physSVG, physH, 0);
    } else {
        physSVG.selectAll("path.field").remove();
    }
    if (physViewCoast) {
        drawPaths(physSVG, "coast", contour(physH, 0));
    } else {
        drawPaths(physSVG, "coast", []);
    }
    if (physViewRivers) {
        drawPaths(physSVG, "river", getRivers(physH, 0.01));
    } else {
        drawPaths(physSVG, "river", []);
    }
    if (physViewSlope) {
        visualizeSlopes(physSVG, {h:physH});
    } else {
        visualizeSlopes(physSVG, {h:zero(physH.mesh)});
    }
}
physDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        physH = generateCoast({npts:4096, extent:defaultExtent});
        physDraw();
    });

physDiv.append("button")
    .text("Copy heightmap from erosion")
    .on("click", function () {
        physH = erodeH;
        physDraw();
    });

var physCoastBut = physDiv.append("button")
    .text("Show coastline")
    .on("click", function () {
        physViewCoast = !physViewCoast;
        physCoastBut.text(physViewCoast ? "Hide coastline" : "Show coastline");
        physDraw();
    });

var physRiverBut = physDiv.append("button")
    .text("Show rivers")
    .on("click", function () {
        physViewRivers = !physViewRivers;
        physRiverBut.text(physViewRivers ? "Hide rivers" : "Show rivers");
        physDraw();
    });

var physSlopeBut = physDiv.append("button")
    .text("Show slope shading")
    .on("click", function () {
        physViewSlope = !physViewSlope;
        physSlopeBut.text(physViewSlope ? "Hide slope shading" : "Show slope shading");
        physDraw();
    });

var physHeightBut = physDiv.append("button")
    .text("Hide heightmap")
    .on("click", function () {
        physViewHeight = !physViewHeight;
        physHeightBut.text(physViewHeight ? "Hide heightmap" : "Show heightmap");
        physDraw();
    });

// Cities

var cityDiv = d3.select("div#city");
var citySVG = addSVG(cityDiv);

var cityViewScore = true;

function newCityRender(h) {
    h = h || generateCoast({npts:4096, extent: defaultExtent});
    return {
        params: defaultParams,
        h: h,
        cities: [],
        poi: []
    };
}
var cityRender = newCityRender(physH);
function cityDraw() {
    cityRender.terr = getTerritories(cityRender);
    if (cityViewScore) {
        var score = cityScore(cityRender.h, cityRender.cities);
        visualizeVoronoi(citySVG, score, d3.max(score) - 0.5);
    } else {
        visualizeVoronoi(citySVG, cityRender.terr);
    }
    drawPaths(citySVG, 'coast', contour(cityRender.h, 0));
    drawPaths(citySVG, 'river', getRivers(cityRender.h, 0.01));
    drawPaths(citySVG, 'border', getBorders(cityRender));
    visualizeSlopes(citySVG, cityRender);
    visualizeCities(citySVG, cityRender);
    visualizeWrecks(citySVG, cityRender);
    visualizePOI(citySVG, cityRender);
}

cityDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        cityRender = newCityRender();
        cityDraw();
    });

cityDiv.append("button")
    .text("Copy heightmap from terrain")
    .on("click", function () {
        cityRender = newCityRender(physH);
        createSVGsymbols();
        cityDraw();
    });

cityDiv.append("button")
    .text("Add new city")
    .on("click", function () {
        placeCity(cityRender);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add 5 cities")
    .on("click", function () {
        placeMultipleCities(cityRender, 5);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add 10 cities")
    .on("click", function () {
        placeMultipleCities(cityRender, 10);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add new point of interest")
    .on("click", function () {
        placePOI(cityRender);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add new wreck")
    .on("click", function () {
        placeWreck(cityRender);
        cityDraw();
    });

var cityViewBut = cityDiv.append("button")
    .text("Show territories")
    .on("click", function () {
        cityViewScore = !cityViewScore;
        cityViewBut.text(cityViewScore ? "Show territories" : "Show city location scores");
        cityDraw();
    });

// Final map

var finalDiv = d3.select("div#final");
var finalMapDiv = d3.select('div#finalMap');
var finalSVG = addSVG(finalMapDiv, 'finalMapSVG');
var editControlsDiv = d3.select('div#editControls');
var editableLabels = false;
var deleteMode = false;
var clickableMode = false;
var dragableMode = false;
var parchmentMode = false;

finalDiv.append("button")
    .text("Label map from terrain")
    .on("click", function () {
        drawMap(finalSVG, cityRender);
    });

var editableBut = editControlsDiv.append("button")
    .text("text_fields")
    .attr('class', 'material-symbols-outlined')
    .on("click", function () {
        resetModes();
        editableLabels = !editableLabels;
        editableBut.classed('active', !editableBut.classed("active"));
        finalMapDiv.attr('contenteditable', editableLabels);
        finalMapDiv.classed("editable", !finalMapDiv.classed("editable"));
    });

var deleteModeBut = editControlsDiv.append("button")
    .text("delete_forever")
    .attr('class', 'material-symbols-outlined')
    .on("click", function() {
        resetModes();
        toggleDeleteMode();
    });

var clickableModeBut = editControlsDiv.append("button")
    .text("add_location")
    .attr('class', 'material-symbols-outlined')
    .on("click", function () {
        resetModes();
        toggleClickableMode();
    });

var dragableModeBut = editControlsDiv.append("button")
    .text("arrows_output")
    .attr('class', 'material-symbols-outlined')
    .on("click", function () {
        resetModes();
        toggleDragableMode();
    });

var parchmentModeBut = editControlsDiv.append("button")
    .text("map")
    .attr('class', 'material-symbols-outlined')
    .on("click", function () {
        resetModes();
        toggleParchmentMode();
    });

let labelStyles = ['fantasy', 'cursive', 'monospace', 'rlyehian', 'cthulhu'];
var styleSelect = finalDiv.append('select')
    .attr('name', 'labelStyle')
    .attr('id', 'labelStyle')
    .on("change", function () {
        setLabelStyle();
    });
styleSelect.append('option')
    .attr('value', 'default')
    .text('default font');
for (var i=0; i<labelStyles.length; i++) {
    styleSelect.append('option')
        .attr('value', labelStyles[i])
        .text(labelStyles[i] + ' font');
};

finalDiv.append("button")
    .text("Download as PNG")
    .attr('id',"downloader")
    .on("click", function () {
        saveSvgAsPng(document.getElementById("finalMapSVG"), "map.png", { 'left': -500, 'top': -500 });
    });

finalDiv.append("button")
    .text("Download as SVG")
    .attr('id',"SVGdownloader")
    .on("click", function () {
        saveSvg(document.getElementById("finalMapSVG"), "map.svg", { 'left': -500, 'top': -500 });
    });

// Quick start options

var quickDiv = d3.select("div#quick");

quickDiv.append("button")
    .text("Generate new random map")
    .on("click", function () {
        createSVGsymbols();
        doMap(finalSVG, defaultParams);
        goToTab('#final');
    });

quickDiv.append("h3")
    .text('Custom settings');

quickDiv.append("input")
    .attr('id', 'npts')
    .attr('placeholder', 'Grid points (65536)')
    .attr('value', 16384)
    .on("change, blur", function () {
        buildCustomParams();
    });

quickDiv.append("input")
    .attr('id', 'nterr')
    .attr('placeholder', 'Territories (5)')
    // .attr('value', 5)
    .on("change, blur", function () {
        buildCustomParams();
    });

quickDiv.append("input")
    .attr('id', 'ncities')
    .attr('placeholder', 'Cities (15)')
    // .attr('value', 15)
    .on("change, blur", function () {
        buildCustomParams();
    });

quickDiv.append("input")
    .attr('id', 'nwrecks')
    .attr('placeholder', 'Wrecks (1)')
    // .attr('value', 3)
    .on("change, blur", function () {
        buildCustomParams();
    });

quickDiv.append("input")
    .attr('id', 'npoi')
    .attr('placeholder', 'Points of interest (1)')
    // .attr('value', 3)
    .on("change, blur", function () {
        buildCustomParams();
    });

quickDiv.append("button")
    .text("Generate map from settings")
    .on("click", function () {
        buildCustomParams();
        createSVGsymbols();
        doMap(finalSVG, customParams);
        goToTab('#final');
    });

quickDiv.append("button")
    .text("Reset to defaults")
    .on("click", function () {
        resetCustomParams();
    });

var customParams = {};

function buildCustomParams() {
    customParams = Object.assign({}, defaultParams);
    customParams.npts = d3.select("#npts").property('value') != '' ? d3.select("#npts").property('value') : defaultParams.npts;
    customParams.ncities = d3.select("#ncities").property('value') != '' ? d3.select("#ncities").property('value') : defaultParams.ncities;
    customParams.nterrs = d3.select("#nterr").property('value') != '' ? d3.select("#nterr").property('value') : defaultParams.nterrs;
    customParams.nwrecks = d3.select("#nwrecks").property('value') != '' ? d3.select("#nwrecks").property('value') : defaultParams.nwrecks;
    customParams.npoi = d3.select("#npoi").property('value') != '' ? d3.select("#npoi").property('value') : defaultParams.npoi;
}

function resetCustomParams() {
    customParams = Object.assign({}, defaultParams);
    d3.select("#npts").property('value', '');
    d3.select("#ncities").property('value', '');
    d3.select("#nterr").property('value', '');
    d3.select("#nwrecks").property('value', '');
    d3.select("#npoi").property('value', '');
    console.log(customParams);
}

// Navigation

var navLinks = document.querySelectorAll("nav a");

for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].addEventListener('click', function (event) {
        navLinks.forEach(function (i){
            i.classList.remove('active');
        });
        this.classList.toggle('active');
        event.preventDefault();
        const anchor = event.target.closest("a");
        if (!anchor) return;
        navClick(anchor.getAttribute('href'));
    });
}

function navClick(target) {
    var examples = document.querySelectorAll('.example')
    examples.forEach(function (i) {
        i.classList.remove('active');
    });
    document.querySelector(target).classList.toggle("active");
}

function goToTab(target) {
    navClick(target);
    navLinks.forEach(function (i) {
        const anchor = i.closest("a");
        if (!anchor) return;
        if (anchor.getAttribute('href') === target) {
            i.classList.add('active');
        } else {
            i.classList.remove('active');
        }
    });
}

function setLabelStyle(){
    var labelStyle = 'labelStyle_' + d3.select("#labelStyle").property('value')
    console.log(labelStyle);
    d3.select("#finalMapSVG").attr('class', labelStyle);
}

function toggleDeleteMode(){
    deleteMode = !deleteMode;
    deleteModeBut.classed('active', !deleteModeBut.classed("active"));
    finalMapDiv.classed("deleteMode", !finalMapDiv.classed("deleteMode"));
    var deletable = d3.selectAll('text.poi, use.wreck, .placedMarker, circle.city, text.city, text.region');

    if(deleteMode) {
        deletable.on("click", function(d,i){
            confirmDeletion(this);
        });
    } else {
        deletable.on("click", null);
    }
}

function confirmDeletion(el) {
    if(confirm('Delete this? Be sure, because this cannot be undone!')){
         el.remove() ;
    }
};

function toggleClickableMode() {
    clickableMode = !clickableMode;
    clickableModeBut.classed('active', !clickableModeBut.classed("active"));
    finalMapDiv.classed("clickableMode", !finalMapDiv.classed("clickableMode"));
    var clickable = d3.select('#finalMapSVG');

    if (clickableMode) {
        clickable.on("click", function (d, i) {
            clickCoordinates(clickable, d3.mouse(this));
        });
    } else {
        clickable.on("click", null);
    }
}

function clickCoordinates(el, coords){
    console.log('clicky');
    console.log(coords);

    // console.log('Drawing circle at', coords[0], coords[1]);
    // el.append("circle")
    //     .attr('class', 'placedMarker')
    //     .attr("cx", coords[0])
    //     .attr("cy", coords[1])
    //     .attr("r", 20)
    //     .style('fill', 'white')
    //     .style('stroke-width', 5)
    //     .style('stroke-linecap', 'round')
    //     .style('stroke', 'red');

    console.log('Drawing cross at', coords[0], coords[1]);
    var cross = d3.symbol().type(d3.symbolCross).size(400);
    el.append("path")
        .attr("d", cross)
        .attr('class', 'placedMarker')
        .attr("transform", "translate(" + coords[0] + ","+ coords[1] + ") rotate(45)");
   }

var deltaX, deltaY;

var dragHandler = d3.drag()
    .on("start", function () {
        var current = d3.select(this);
        deltaX = current.attr("x") - d3.event.x;
        deltaY = current.attr("y") - d3.event.y;
        deltaCX = current.attr("cx") - d3.event.x;
        deltaCY = current.attr("cy") - d3.event.y;
        // Move linked labels when moving city circles
        if(current.node().tagName == "circle"){
            var selecta = 'text#'+current.attr("id");
            var linkedLabel = d3.select(selecta);
            labelDeltaX = linkedLabel.attr("x") - d3.event.x;
            labelDeltaY = linkedLabel.attr("y") - d3.event.y;
        }
    })
    .on("drag", function () {
        var current = d3.select(this);
        current.attr("x", d3.event.x + deltaX)
            .attr("y", d3.event.y + deltaY)
            .attr("cx", d3.event.x + deltaCX)
            .attr("cy", d3.event.y + deltaCY);
        // Move linked labels when moving city circles
        if(current.node().tagName == "circle"){
            var selecta = 'text#'+current.attr("id");
            var linkedLabel = d3.select(selecta);
            linkedLabel.attr("x", d3.event.x + labelDeltaX)
                .attr("y", d3.event.y + labelDeltaY);
        }
    });

function toggleDragableMode() {
    dragableMode = !dragableMode;
    dragableModeBut.classed('active', !dragableModeBut.classed("active"));
    finalMapDiv.classed("dragableMode", !finalMapDiv.classed("dragableMode"));
    var dragable = d3.selectAll("text.poi, use.wreck, path.placedMarker, circle.city, text.city, text.region");

    if (dragableMode) {
        dragHandler(dragable);
    } else {
        dragable.on(".drag", null);
    }
}

function toggleParchmentMode() {
    parchmentMode = !parchmentMode;
    parchmentModeBut.classed('active', !parchmentModeBut.classed("active"));
    finalMapDiv.classed("parchment", !finalMapDiv.classed("parchment"));
}

function resetModes() {
        // var controls = d3.selectAll('#editControls button')
        // controls.classed('active', false);
        finalMapDiv.classed('deleteMode, dragableMode, clickableMode', false);
}