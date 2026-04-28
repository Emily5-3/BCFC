//  script.js — Leaflet map loading from pre-geocoded JSON
//    - Loads ./assets/data.geocoded.json
//    - Marker clustering, type filters, name search, ZIP filter
//    - Export filtered features as GeoJSON
//     - Beginner interactive enhancements added


// GET HTML ELEMENTS (Retrieves elements from HTML file and stores them as variables) //
const STATUS = document.getElementById('status');
const SEARCH = document.getElementById('searchBox');
//const ZIP_INPUT = document.getElementById('zipBox'); - check if this is in HTML bc then it could actually work, but rn everything turned off
const RESET = document.getElementById('resetBtn');
const DOWNLOAD = document.getElementById('downloadBtn');
const SCREENSHOT = document.getElementById('screenshotBtn');
const TYPE_FILTERS = document.getElementById('typeFilters');
const SELECT_ALL = document.getElementById('selectAllBtn');



// MAP DEFAULT SETTINGS //
const DEFAULT_COORDS = [42.0987, -75.9180]; //starting center for the map
const DEFAULT_ZOOM = 12; //starting zoom
const ICON_URL = 'https://cdn-icons-png.flaticon.com/512/684/684908.png'; //icon used if no custom icon

// CUSTOM ICONS //
const blessingBoxIcon = L.icon({
  iconUrl: './Completed markers/blessing_box.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const communityMealsIcon = L.icon({
  iconUrl: './Completed markers/community_meals.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const foodPantryIcon = L.icon({
  iconUrl: './Completed markers/food_pantries.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const foodPantrySchoolIcon = L.icon({
  iconUrl: './Completed markers/food_pantryschool.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const mobileFoodPantryIcon = L.icon({
  iconUrl: './Completed markers/mobile_foodpantry.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const seniorCenterIcon = L.icon({
  iconUrl: './Completed markers/senior_center.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});

const shelterIcon = L.icon({
  iconUrl: './Completed markers/shelter.png',
  iconSize: [38, 40],
  iconAnchor: [16, 32],
});



// HELPER FUNCTIONS //

//update text in status box- see example in line 256 how this is used
function setStatus(msg) {
  STATUS.textContent = msg;
}

//safely fetch JSON file and return the data as JavaScript
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}`);
  return r.json();
}

// debounce wrapper (delays a function, such as filling in possible searches as someone types)
function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}



// BUILD POPUP CONTENT //
// basically allows the food resource info to pop up nicely (address etc.), HTML-formatted
function buildPopup(row) {
  const info = [
    ['Type', row.Type],
    ['Address', [row.Street, row.City, row.State, row.Zip].filter(Boolean).join(', ')], // joins all address info into one line
    ['Hours', row['Hours of Operation']],
    ['Area', row['Area Served']],
    ['Deliveries', row['Deliveries?']],
    ['Services', row['Additional Services Offered']],
    ['Drive Thru', row['Drive Thru?']],
    ['Contact', row['Contact']],
    ['Phone', row['Phone']],
    ['Email', row['Email']]
  ];

// allows website users to copy the info displayed as clean text, not HTML-formatted
  const copyText = `
${row.Name || 'Community Location'}
Type: ${row.Type || 'N/A'}
Address: ${[row.Street, row.City, row.State, row.Zip].filter(Boolean).join(', ') || 'N/A'}
Hours: ${row['Hours of Operation'] || 'N/A'}
Contact: ${row['Phone'] || row['Email'] || 'N/A'}
`.trim();

//turns JavaScript into HTML
  const infoHtml = info
    .filter(([_, v]) => v) //makes sure no empty data is reported, only places with a value (v)
    .map(([k, v]) => `<div class="marker-meta"><b>${k}:</b> ${v}</div>`) //transforms JavaScript information into HTML
    .join(''); //joins information into one large string

  const safeCopyData = encodeURIComponent(copyText); //converts text into a safe format that won't break HTML

  //actually builds the popup 
  return `
    <div class="marker-title">${row.Name || ''}</div>
    ${infoHtml}
    <hr style="margin: 5px 0; border-top: 1px solid #ddd;">
    <button class="copy-btn" data-copy-text="${safeCopyData}" style=" //stores encoded text into copy button
        padding: 5px 10px; 
        background-color: #4CAF50; 
        color: white; 
        border: none; 
        border-radius: 4px; 
        cursor: pointer;
    ">Copy Info</button>
  `;
}



// COPY BUTTON FUNCTION //
function copyToClipboard(text, buttonElement) {
    const textarea = document.createElement('textarea'); //creates a hidden textbox to be copied
    textarea.value = text;
    textarea.style.position = 'fixed'; //prevents scrolling jump
    textarea.style.opacity = '0';
    
    document.body.appendChild(textarea); //adds textarea to the page
    textarea.select();

    try {
        const successful = document.execCommand('copy'); //attempt to copy text to clipboard
        const originalText = buttonElement.textContent; //save button's original text

        //change button text to 'Copied!' if successful
        if (successful) { 
            buttonElement.textContent = 'Copied!';
            setTimeout(() => {
                buttonElement.textContent = originalText;
            }, 1000);
        //change button text to 'Copy Failed' if not successful
        } else {
            buttonElement.textContent = 'Copy Failed';
            setTimeout(() => {
                buttonElement.textContent = originalText;
            }, 1500);
        }
    } catch (err) {
        console.error('Unable to copy text: ', err);
    } finally {
        document.body.removeChild(textarea); //removes that hidden textbox for cleanup
    }
}



// CLICK HANDLER FOR COPY BUTTON //
//runs whenever user clicks anywhere on the page//
function handleCopyClick(e) {
    const btn = e.target.closest('.copy-btn'); //find closest element with the class 'copy-btn'
    if (!btn) return; //if the click was not on a copy button, stop here
    const encodedText = btn.dataset.copyText; //get encoded text
    const textToCopy = decodeURIComponent(encodedText); //decode it so it's readable
    copyToClipboard(textToCopy, btn); //call the copy function, with the text to copy and the button so its label can be updated
}



// CONVERT TO GEOJSON //
function toGeoJSON(features) {
  return {
    //convert each feature into a GeoJSON "feature"
    type: "FeatureCollection",
    features: features.map(({ row }) => ({ 
      type: "Feature",
      //puts each point on the map in [longitude, latitude] format
      geometry: row.longitude && row.latitude
        ? { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] }
        : null, //if there are no coordinates, set to null
      properties: { ...row } //copy all the extra data (name, address...) into properties
    })).filter(f => f.geometry) //remove features without valid geometry
  };
}



// DOWNLOAD FILE //
//downloads JavaScript object as a JSON file
function downloadJSON(filename, obj) { 
  //converts object into a JSON string, formatting it nicely with indentation
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }); //creates a "blob", a file-like object in memory, then tells browser it's JSON
  const url = URL.createObjectURL(blob); //creates a temporary URL that points to the blob 
  const a = document.createElement('a'); //creates a temporary link element 
  a.href = url; //set link to blob URL
  a.download = filename; //set filename for download
  document.body.appendChild(a); //add link to page so click works
  a.click(); //"clicks" the link to trigger download
  a.remove(); //remove link from page for cleanup
  URL.revokeObjectURL(url); //delete blob URL 
}



// FILTER FUNCTION //
//takes all data points and only returns the ones that the user filtered for
function filterRows(rows) {
  console.log("check if filtered");

  //keep only the checked boxes 
  const activeTypes = new Set(
    [...TYPE_FILTERS.querySelectorAll('input[type=checkbox]')]
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.type) //get the type from data-type attribute
  );

  console.log(activeTypes) 

  //get what user typed, remove extra spaces, and make lowercase
  const query = SEARCH.value.trim().toLowerCase();
  //const zipList = ZIP_INPUT.value.split(',').map(z => z.trim()).filter(Boolean);

  console.log(activeTypes.size) //prints how many checkboxes are selected
  // problem with reset not working

  return rows.filter(row => {
    if (activeTypes.size >= 0 && !activeTypes.has(row.Type)) return false; //remove row if it is not in selected types



// BUILD SEARCHABLE TEXT //
//combines all fields into one string so it can all be searched at the same time
const searchable = [
  row.Name,
  row.Type,
  row.Street,
  row.City,
  row.State,
  row.Zip,
  row['Hours of Operation'],
  row['Area Served'],
  row['Deliveries?'],
  row['Additional Services Offered'],
  row['Drive Thru'],
  row.Contact,
  row.Phone,
  row.Email
]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

    //if user typed something that is not found, remove the row
    if (query && !searchable.includes(query)) return false;

    // 🔹 ZIP filter
    //if (zipList.length && (!row.Zip || !zipList.includes(String(row.Zip)))) return false;

    return row.latitude && row.longitude; //make sure row has both latitude and longitude
  });
}



// MAIN FUNCTION START//
(async function main() {
  //show loading message while data is fetched
  setStatus('Loading geocoded data…');

  //fetch the dataset (already has latitude/longitude)
  const rows = await fetchJSON('./assets/data.geocoded.json');
  const flood06data = await fetchJSON('./assets/2006_Flood.geojson');
  const flood11data = await fetchJSON('./assets/2011_Flood.geojson');

  //pair each type with its icon
  const typeIconURLs = {
  "Blessing Boxes": './icons/box.png',
  "Community Meals": './icons/community.png',
  "Food Pantries": './icons/food_pantry.png',
  "Food Pantries (School)": './icons/school.png',
  "Mobile Food Pantries": './icons/van.png',
  "Senior Centers": './icons/senior.png',
  "Shelters": './icons/shelter.png'
};

  //extract all 'Type' values from dataset
  const types = Array.from(new Set(rows.map(r => r.Type).filter(Boolean))).sort();

//build type filter checkboxes
  let i = 0 ; 
types.forEach(t => {

  const id = `type_${t.replace(/\W+/g,'_')}`; //build HTML id for each type
  const colors = ['#289237ff','#3a5ddbff','#24a0a0ff','#6e1788ff','#a11337ff','#d46e26ff','#d0ad14ff','#f032e6','#bcf60c']; //give each type its own color

  //create a container for each filter
  const contanier = document.createElement('div');
  contanier.id = id;
  contanier.classList.add('type-filter-item');
  contanier.style.color = colors[i];
  contanier.style.backgroundColor = i%2==0 ? '#f0f0f0' : '#ffffff';
  i++;

  // Create checkbox input for filtering
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  //checkbox.id = id;
  checkbox.dataset.type = t; //store type data for filtering

  // Create icon image
  const img = document.createElement('img');
  img.src = typeIconURLs[t];  // make sure these exist in /icons folder
  img.style.width = '20px';
  img.style.height = '20px';
  img.style.marginRight = '5px';
  img.style.verticalAlign = 'middle';

  // Create label (contains checkbox, icon, and text)
  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.marginBottom = '4px';

  //assemble checkbox and icon
  label.appendChild(checkbox);
  label.appendChild(img);

  //create and style text label
  const textSpan = document.createElement('span');
  textSpan.textContent = t;
  textSpan.style.fontWeight = 'bold';   
  textSpan.style.marginLeft = '5px';    

  label.appendChild(textSpan);

  //add label into container
  contanier.appendChild(label);

  //add container to filter UI
  TYPE_FILTERS.appendChild(contanier);
});

  //assign colors per type
  const colors = ['#289237ff','#3a5ddbff','#24a0a0ff','#6e1788ff','#a11337ff','#d46e26ff','#d0ad14ff','#f032e6','#bcf60c']; 
  const typeColors = {}; 
  types.forEach((t,i) => typeColors[t] = colors[i % colors.length]); //map each type to a color for markers



// CREATE MAP //
  const map = L.map('map').setView(DEFAULT_COORDS, DEFAULT_ZOOM);

  //base map layer with default map tiles
  const baseMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);



// ADDITIONAL BASE MAP OPTIONS //
//allows user to switch map styles
var OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

var Jawg_Light = L.tileLayer('https://tile.jawg.io/jawg-light/{z}/{x}/{y}{r}.png?access-token={accessToken}', {
	attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	minZoom: 0,
	maxZoom: 22,
	accessToken: '3A5nCr2WKb0bh4VPV8j1uEaxx1wimWGiJwR6VdBksPdJJTsMekWPWYvgLCgvUJB6'
});

var Jawg_Dark = L.tileLayer('https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token={accessToken}', {
	attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	minZoom: 0,
	maxZoom: 22,
	accessToken: '3A5nCr2WKb0bh4VPV8j1uEaxx1wimWGiJwR6VdBksPdJJTsMekWPWYvgLCgvUJB6'
});

var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data &copy; OpenStreetMap contributors'
});

// Add your DEFAULT basemap:
OpenStreetMap_Mapnik.addTo(map);

// Basemap options for switching:
var baseMaps = {
    "Default": OpenStreetMap_Mapnik,
    "Satellite": Esri_WorldImagery,
    "Blank": Jawg_Light,
    "Dark": Jawg_Dark,
    "Topography": OpenTopoMap,
};

// Add clickable basemap layer control:
L.control.layers(baseMaps, null, {
    position: 'bottomright',
    collapsed: false
}).addTo(map);



// CLUSTER MARKERS //
//groups nearby markers together when zoomed out for cleanliness
//changed "disableClusteringAtZoom" from 11 to 19 to indicate number of places in single location at further zoom
 const cluster = L.markerClusterGroup({
  disableClusteringAtZoom: 19 
}).addTo(map);

//styling for 2006 flood
const FloodStyle1 = {
  color: "rgb(29, 209, 35)",
  weight: 4,
  opacity: 0.8
};

//styling for 2011 flood
const FloodStyle2 = {
  color: "rgb(209, 29, 113)",
  weight: 4,
  opacity: 0.8
};

// FLOOD MAPS //
// const flood11 = L.geoJSON(flood11data, { style: routeStyle });
const flood06 = L.geoJSON(flood06data, { style: FloodStyle1 });
const flood11 = L.geoJSON(flood11data, { style: FloodStyle2 });

//TOGGLE FLOOD 2006
const toggleFlood06 = document.getElementById("toggleFlood06");
let flood06Visible = false; //tracks visibility

toggleFlood06.addEventListener("click", () => {
  flood06Visible = !flood06Visible;

  if (flood06Visible) {
    flood06.addTo(map);            
    toggleFlood06.classList.add("active-flood");
  } else {
    map.removeLayer(flood06);
    toggleFlood06.classList.remove("active-flood");
  }
});

//TOGGLE FLOOD 2011
const toggleFlood11 = document.getElementById("toggleFlood11");
let flood11Visible = false; //tracks visibility

toggleFlood11.addEventListener("click", () => {
  flood11Visible = !flood11Visible;

  if (flood11Visible) {
    flood11.addTo(map);            
    toggleFlood11.classList.add("active-flood");
  } else {
    map.removeLayer(flood11);
    toggleFlood11.classList.remove("active-flood");
  }
});

// ROUTE 86 LINE (GeoJSON) //
const routeLine = {
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-76.80510126911796, 42.08992828402145],
      [-76.78692131499254, 42.090476637548015],
      [-76.70803071240952, 42.02409941652692],
      [-76.64966584591532, 42.018488247723106],
      [-76.61629748996636, 42.00020867577443],
      [-76.44164507907941, 42.02669362310484],
      [-76.40180057070435, 42.02126509003903],
      [-76.30139162377996, 42.08267937523969],
      [-76.24952042392287, 42.10159914605536],
      [-76.21171599052128, 42.082026869692854],
      [-76.16775734923927, 42.087572961145604],
      [-76.13039250414955, 42.059837655817475],
      [-75.95895379844585, 42.11986115507637],
      [-75.92818274625327, 42.11464397526138],
      [-75.92673382400608, 42.11354075247011],
      [-75.91263109026185, 42.111459693790245],
      [-75.90748811000081, 42.11467513021304],
      [-75.89847537558289, 42.114538687544204],
      [-75.89782794130892, 42.102895794103254],
      [-75.8958345129744, 42.099403596112566],
      [-75.89688660030023, 42.09915708066073],
      [-75.89716629847779, 42.09949712120231]
    ]
  }
};

//styling for route line
const routeStyle = {
  color: "#0000FF",
  weight: 4,
  opacity: 0.8
};

// AVOID TOMPKINS BRIDGE LINE (GeoJSON) //
const routeLine2 = {
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-76.80510126911796, 42.08992828402145],
      [-76.78692131499254, 42.090476637548015],
      [-76.70803071240952, 42.02409941652692],
      [-76.64966584591532, 42.018488247723106],
      [-76.61629748996636, 42.00020867577443],
      [-76.44164507907941, 42.02669362310484],
      [-76.40180057070435, 42.02126509003903],
      [-76.30139162377996, 42.08267937523969],
      [-76.24952042392287, 42.10159914605536],
      [-76.21171599052128, 42.082026869692854],
      [-76.16775734923927, 42.087572961145604],
      [-76.13039250414955, 42.059837655817475],
      [-76.04514267080738, 42.090362768675725],
      [-76.04432478734347, 42.087861870515724],
      [-76.04336819180826, 42.08753020885373],
      [-76.04448403438332, 42.088485687321835],
      [-76.04311074344093, 42.0891226427117],
      [-75.99397267451006, 42.09679745237761],
      [-75.95912541510302, 42.09507786625565],
      [-75.93628445579175, 42.08729929108063],
      [-75.92497070731373, 42.086653425524524],
      [-75.9100556108509, 42.09113155570007],
      [-75.90949956125108, 42.0901369235522],
      [-75.90148512086165, 42.09102067444432],
      [-75.90165678222314, 42.093751466502056],
      [-75.89505854811004, 42.09491380881244],
      [-75.89716139984152, 42.09964257082665]
    ]
  }
};

//styling for route line
const routeStyle2 = {
  color: "#d11d1dff",
  weight: 4,
  opacity: 0.8
};



// ROUTE LAYERS //
// Create GeoJSON layers for each route, but do NOT add to map yet
const routeLayer = L.geoJSON(routeLine, { style: routeStyle });
const routeLayer2 = L.geoJSON(routeLine2, { style: routeStyle2 });



// ROUTE 86 TOGGLE //
const toggleRoute86 = document.getElementById("toggleRoute86");
let route86Visible = false; //tracks visibility

toggleRoute86.addEventListener("click", () => {
  route86Visible = !route86Visible; //makes it the opposite of what it already was with a click

  if (route86Visible) {
    routeLayer.addTo(map); //show route
    toggleRoute86.classList.add("active-route");
  } else {
    map.removeLayer(routeLayer); //hide route
    toggleRoute86.classList.remove("active-route");
  }
});



// AVOID TOMPKINS BRIDGE ROUTE TOGGLE //
const toggleTompkins = document.getElementById("toggleTompkins");
let tompkinsVisible = false; //tracks visibility

toggleTompkins.addEventListener("click", () => {
  tompkinsVisible = !tompkinsVisible;

  if (tompkinsVisible) {
    routeLayer2.addTo(map);            
    toggleTompkins.classList.add("active-route");
  } else {
    map.removeLayer(routeLayer2);
    toggleTompkins.classList.remove("active-route");
  }
});



// MARKER REFRESH //
  function refreshMarkers() {
    cluster.clearLayers(); //remove all existing markers from cluster
    
    const filtered = filterRows(rows); //apply filters/search to dataset

    const features = []; //empty array to allow coordinate storage

    //loop through filtered data set to process locations one by one 
    for (const row of filtered) {
      const lat = Number(row.latitude), lon = Number(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) continue; //skip invalid coordinates

      // pick correct icon
      let icon;
      switch(row.Type) {
        case "Blessing Boxes":
          icon = blessingBoxIcon;
          break;
        case "Community Meals":
          icon = communityMealsIcon;
          break;
        case "Food Pantries":
          icon = foodPantryIcon;
          break;
        case "Food Pantries (School)":
          icon = foodPantrySchoolIcon;
          break;
        case "Mobile Food Pantries":
          icon = mobileFoodPantryIcon;
          break;
        case "Senior Centers":
          icon = seniorCenterIcon;
          break;
        case "Shelters":
          icon = shelterIcon;
          break;
        default:
          //use if icon is unknown
          icon = L.icon({
            iconUrl: ICON_URL,
            iconSize: [25, 25],
            iconAnchor: [12, 25],
            popupAnchor: [0, -25]
          });
      }



// MARKER CREATION //
      const marker = L.marker([lat, lon], { icon });
      marker.bindPopup(buildPopup(row)); //attach popup to row data
      marker.bindTooltip(row.Name || '', { direction: 'top' }); //shows food resource name with mouse hover

      cluster.addLayer(marker); //adds markers to map, group into cluster when zoomed out
      features.push({ lat, lon }); //save coordinates
    }



// STATUS UPDATE //
    //if there is at least one location with coordinates selected...
    if (features.length) {
      // NOTE: unfortunately the next two lines break the map, so that's why they're commented out
      //const bounds = L.latLngBounds(features.map(f => [f.lat, f.lon])); //create a box that contains all selected locations
      //map.fitBounds(bounds.pad(0.1)); //zoom in or out to fit that box
      setStatus(`Showing ${features.length} location(s).`); //update to tell user how many locations are shown

    //if there aren't any locations selected...
    } else {
      //map.setView(DEFAULT_COORDS, DEFAULT_ZOOM); //set map zoom to default
      setStatus('Select filters to view locations.'); //tells user to select filters
    }
  }



// FILTER/SEARCH EVENTS //

  //re-run filtering if checkboxes are changed
  TYPE_FILTERS.addEventListener('change', refreshMarkers);

  //debounce to avoid excessive updates
  SEARCH.addEventListener('input', debounce(refreshMarkers, 250));



// RESET BUTTON //
  RESET.addEventListener('click', () => { //when user clicks button...
    SEARCH.value = ''; //clear search input
    //ZIP_INPUT.value = '';
    TYPE_FILTERS.querySelectorAll('input[type=checkbox]').forEach(cb => {cb.checked = false}); //uncheck all checkboxes
    refreshMarkers();
  });



// SELECT ALL BUTTON //
  SELECT_ALL.addEventListener('click', () => { //when user clicks button...
  TYPE_FILTERS.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = true; //check all checkboxes
  });
  refreshMarkers();
});



// DOWNLOAD GEOJSON //
  const DOWNLOAD = document.getElementById('downloadBtn');

  if (DOWNLOAD) {
    DOWNLOAD.addEventListener('click', () => { //when user clicks button...
      const filteredRows = filterRows(rows); //apply filters
      const geojsonData = toGeoJSON(filteredRows); //convert to GeoJSON
      downloadJSON('filtered_data.geojson', geojsonData); //trigger download
    });
  }



// COPY CLICK HANDLER //
//attach global click handler to map container, telling it to stay aware of any clicks the user makes
  map.getContainer().addEventListener('click', handleCopyClick);



// SCREENSHOT FEATURE //
  SCREENSHOT.addEventListener('click', () => { //when user clicks button...
    //temporarily hide popup for clean screenshot
    const popup = document.querySelector('.leaflet-popup-pane');
    if (popup) popup.style.display = 'none';
    
    //hide header
    const controls = document.querySelector('header');
    if (controls) controls.style.display = 'none';

    //screenshot entire body (visible webpage)
    const captureElement = document.body;

    //capture the page with html2canvas
    html2canvas(captureElement, {
      logging: false, 
      useCORS: true, 
      scrollX: 0,
      scrollY: 0
    }).then(canvas => {

      //create download link
      const a = document.createElement('a');
      a.download = 'community_map_screenshot.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click(); //triggers download
      document.body.removeChild(a);

      //restore hidden elements
      if (popup) popup.style.display = 'block';
      if (controls) controls.style.display = 'block';
    });
  });



// INITIAL MAP SETUP //
  map.setView(DEFAULT_COORDS, DEFAULT_ZOOM);
  setStatus('Select filters to view locations.'); //starting UI status



// RADAR OVERLAY SYSTEM //
function setupRadarOverlay(map) {

  // UI elements
  const btnToggleRadar = document.getElementById("toggleRadar");
  const timeline = document.getElementById("timeline");
  const track = document.getElementById("timeline-track");
  const timestampBox = document.getElementById("timestamp");

  // Internal state
  let radarFrames = [];
  let radarTimes = [];
  let radarLayers = [];
  let radarIndex = 0;
  let radarActive = false;
  let animationFrame = null;




// TIMELINE UI FOR RADAR //
  function buildTimeline() {
    track.innerHTML = ""; //start fresh whenever timeline built

    if (!radarFrames.length) return; //if there are no radar frames, stop here

    //create a tick for each radar frame
    const n = radarFrames.length;
    for (let i = 0; i < n; i++) {
      const tick = document.createElement("div");
      tick.className = "timeline-tick";
      tick.style.left = `${(i / (n - 1)) * 100}%`; //converts ticks to percentages so they are positioned evenly across timeline
      track.appendChild(tick); //adds each tick into timeline container
    }

    //adds the moving marker
    const marker = document.createElement("div");
    marker.className = "timeline-marker";
    marker.id = "timeline-marker";
    marker.style.left = "0%"; //starts marker at the beginning of the timeline
    track.appendChild(marker); //adds it to the timeline UI
  }

  //moves the marker to a new position
  function updateTimelineMarker(i) {
    const marker = document.getElementById("timeline-marker"); //finds the marker
    if (!marker || radarFrames.length <= 1) return; //stop if marker doesn't exist or move
    marker.style.left = `${(i / (radarFrames.length - 1)) * 100}%`; //moves marker along timeline with percentage logic
  }



// TIMESTAMP BOX UPDATE //
//converts UNIX time to something more human-friendly
  function updateTimestamp(unix) {
    const d = new Date(unix * 1000); //convert UNIX time into JavaScript time 
    timestampBox.textContent = d.toISOString().replace("T", " ").split(".")[0] + " UTC"; //convert to more human-friendly format and display it
  }



// LOAD FRAMES FROM RAINVIEWER //
  async function loadRadarFrames() {
    try {
      const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const data = await res.json();

      //extract tile paths + timestamps
      radarFrames = data.radar.past.map(f => f.path);
      radarTimes = data.radar.past.map(f => f.time);

      //remove old layers
      radarLayers.forEach(l => map.removeLayer(l));
      radarLayers = [];

      //create tile layers for each frame
      radarFrames.forEach((path, i) => {
        const layer = L.tileLayer(
          `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`,
          { opacity: i === 0 ? 0.6 : 0, zIndex: 50 + i }
        );

        //radar layers only shown if turned on by user
        if (radarActive) layer.addTo(map);

        //every created layer stored in an array so can be controlled together
        radarLayers.push(layer);
      });

      radarIndex = 0; //resets animation after loop
      buildTimeline(); 

      //start animation loop if radar turned on
      if (radarActive) animateRadar();

      //if an error occurs, logged in the console
    } catch (err) {
      console.error("Radar load error:", err);
    }
  }



// CROSSFADE ANIMATION //
  function animateRadar() {
    if (!radarLayers.length || !radarActive) return; //stop immediately if radar turned off or no radar frames

    //pick current and next frames
    const current = radarLayers[radarIndex];
    const nextIndex = (radarIndex + 1) % radarLayers.length;
    const next = radarLayers[nextIndex];

    //animation timing setup
    let t = 0;
    const duration = 2000;
    const start = performance.now();

    //updates UI immediately
    updateTimestamp(radarTimes[nextIndex]);
    updateTimelineMarker(nextIndex);

    //animation loop
    function step(now) {
      t = (now - start) / duration;
      if (t > 1) t = 1;

      // cosine ease for smooth animation
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);

      //fades frames in and out
      current.setOpacity(0.6 * (1 - eased));
      next.setOpacity(0.6 * eased);

      //continue or finish animation
      if (t < 1) {
        animationFrame = requestAnimationFrame(step); //if transition is incomplete, keep animating
      } else {
        radarIndex = nextIndex;
        animationFrame = requestAnimationFrame(() => animateRadar()); //if transition is complete, move to next frame and restart
      }
    }

    //starts animation
    animationFrame = requestAnimationFrame(step);
  }



// TOGGLE RADAR ON/OFF //
  btnToggleRadar.addEventListener("click", () => { //when user clicks button...
    radarActive = !radarActive; //toggles radar state (makes opposite of what it was)

    //if radar is turning on...
    if (radarActive) {
      //update button
      btnToggleRadar.textContent = "🌧️ Radar On";
      btnToggleRadar.classList.add("active");

      //show UI elements
      timeline.classList.add("visible");
      timestampBox.classList.add("visible");

      //add radar layers to map
      radarLayers.forEach(l => l.addTo(map));
      animateRadar(); //start animation

    //if radar is turning off...
    } else {
      //update button
      btnToggleRadar.textContent = "🌧️ Radar Off";
      btnToggleRadar.classList.remove("active");

      //hide UI elements
      timeline.classList.remove("visible");
      timestampBox.classList.remove("visible");

      if (animationFrame) cancelAnimationFrame(animationFrame); //stop animation loop
      radarLayers.forEach(l => map.removeLayer(l)); //remove radar layers
    }
  });



// EXPOSE ONLY WHAT IS NECESSARY //
  loadRadarFrames(); // initial load

  return {
    loadRadarFrames,   // allow periodic refresh
  };
}

//initialize radar systems
const radar = setupRadarOverlay(map);

// auto-refresh radar frames every 10 minutes
setInterval(() => radar.loadRadarFrames(), 10 * 60 * 1000);
// ========= NEW RADAR CODE
})();