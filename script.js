'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  time;

  constructor(coords, distance, duration, rating, locationData, weatherData) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.rating = rating;
    this.locationData = locationData;
    this.weatherData = weatherData;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const { city, country, timezone } = this.locationData;
    const [date, time] = this._getLocalDate(timezone).split(',');
    const [month, day, year] = date.split('/');

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(
      1
    )} in ${city}, ${country} on ${months[month - 1]} ${day}, ${year} `;
    this.time = time;
  }

  _setLocalTime() {
    const [hour, minute, second] = this.time.split(':');
    this.localTime = `${hour}:${minute}`;
  }

  _getLocalDate(timezone) {
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    };

    const localDate = new Date().toLocaleTimeString([], options);
    return localDate;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, rating, locationData, weatherData) {
    super(coords, distance, duration, rating, locationData, weatherData);
    this._setDescription();
    this._setLocalTime();
  }
}

class Walking extends Workout {
  type = 'walking';

  constructor(coords, distance, duration, rating, locationData, weatherData) {
    super(coords, distance, duration, rating, locationData, weatherData);
    this._setDescription();
    this._setLocalTime();
  }
}

///////////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputRating = document.querySelector('.form__input--rating');
const bodyMap = document.querySelector('#map');
const btnSort = document.querySelector('.btn__sort');
const btnDeletAll = document.querySelector('.btn__delete--all');
const formEdit = document.querySelector('.form__edit');
const inputTypeEdit = document.querySelector('.form__input--type--edit');
const inputDistanceEdit = document.querySelector(
  '.form__input--distance--edit'
);
const inputDurationEdit = document.querySelector(
  '.form__input--duration--edit'
);
const inputRatingEdit = document.querySelector('.form__input--rating--edit');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #sorted = false;
  #editedWorkout;

  constructor() {
    // Get user's position
    this._getPosition();
    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    formEdit.addEventListener('submit', this._editedWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._edit.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    btnSort.addEventListener('click', this._sortWorkouts.bind(this));
    btnDeletAll.addEventListener('click', this._reset.bind(this));
  }

  _getPosition() {
    const spinner = `<div class="spinner-container">
                      <div class="spinner">
                        <svg>
                          <use xlink:href="icons.svg#icon-loader"></use>
                        </svg>
                      </div>
                    </div>`;

    bodyMap.insertAdjacentHTML('afterbegin', spinner);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this._hideFormEdit();
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _showFormEdit() {
    formEdit.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value = inputDuration.value = inputRating.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _hideFormEdit() {
    formEdit.style.display = 'none';
    formEdit.classList.add('hidden');
    setTimeout(() => (formEdit.style.display = 'grid'), 1000);
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const rating = +inputRating.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    let locationData;

    if (!this._validateInputs(distance, duration, rating))
      return alert('Inputs have to be positive numbers!');

    const whereAmI = function (lat, lng) {
      fetch(`https://geocode.xyz/${lat},${lng}?geoit=json`)
        .then(response => {
          if (!response.ok)
            throw new Error(`Problem with geocoding ${response.status}`);

          return response.json();
        })
        .then(data => {
          if (data.error) {
            throw new Error(`Geocoding error: ${data.error}`);
          }

          if (!data.city || !data.country) {
            throw new Error(
              'City or Country information not found in the response.'
            );
          }

          locationData = {
            city: data.city,
            country: data.country,
            timezone: data.timezone,
          };

          console.log(data);
          return fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
          );
        })
        .then(response => {
          if (!response.ok)
            throw new Error(
              `Problem with weather API response ${response.status}`
            );

          return response.json();
        })
        .then(data => {
          if (data.error) {
            throw new Error(`weather data error: ${data.error}`);
          }
          const weatherData = {
            temperature: data.current_weather.temperature,
            weathercode: data.current_weather.weathercode,
            windspeed: data.current_weather.windspeed,
          };
          console.log(data);
          createWorkout(locationData, weatherData);
        })
        .catch(err => {
          console.log(`${err.message} 💥`);
          return alert(
            `It's a Free third party API and there's limitation for requests per second, so try it again.`
          );
        });
    };

    whereAmI(lat, lng);

    const createWorkout = function (locationData, weatherData) {
      // If workout running, create running object
      if (type === 'running') {
        workout = new Running(
          [lat, lng],
          distance,
          duration,
          rating,
          locationData,
          weatherData
        );
      }

      // If workout walking, create walking object
      if (type === 'walking') {
        workout = new Walking(
          [lat, lng],
          distance,
          duration,
          rating,
          locationData,
          weatherData
        );
      }
      // Add new object to workout array
      this.#workouts.push(workout);
      // Render workout on map as marker
      this._renderWorkoutMarker(workout);
      // Render workout on list
      this._renderWorkout(workout);
      // Hide form + Clear input fields
      this._hideForm();
      // Set local storage to all workouts
      this._setLocalStorage();
    }.bind(this);
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃🏻‍♂️' : '🚶🏻‍♂️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    const weatherInfo = {
      0: 'Clear Sky',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing Rime Fog',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Dense Intensity of Drizzle',
      56: 'Light Freezing Drizzle',
      57: 'Dense Intensity of Freezing Drizzle',
      61: 'Slight Rain',
      63: 'Moderate Rain',
      65: 'Heavy Intensity of Rain',
      66: 'Light Freezing Rain',
      67: 'Heavy Intensity of Freezing Rain',
      71: 'Slight Snow Fall',
      73: 'Moderate Snow Fall',
      75: 'Heavy Intensity of Snow Fall',
      77: 'Snow Grains',
      80: 'Slight Rain Showers',
      81: 'Moderate Rain Showers',
      82: 'Violent Rain Showers',
      85: 'Slight Snow Showers',
      86: 'Heavy Snow Showers',
      95: 'Slight or Moderate Thunderstorm',
      96: 'Thunderstorm with Slight Hail',
      99: 'Thunderstorm with Heavy Hail',
    };
    // Thunderstorm forecast with hail is only available in Central Europe
    const weatherDescription =
      weatherInfo[workout.weatherData.weathercode] ??
      'No Details About the Weather';
    const html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <h2 class="workout__title">${weatherDescription} at ${
      workout.localTime
    } Local Time</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃🏻‍♂️' : '🚶🏻‍♂️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱️</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">💨</span>
        <span class="workout__value">${workout.weatherData.windspeed}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🌡️</span>
        <span class="workout__value">${workout.weatherData.temperature}</span>
        <span class="workout__unit">°C</span>
      </div>
      <div>
        <span class="workout__icon">👍🏻</span>
        <span class="workout__value">${workout.rating}</span>
        <span class="workout__unit">/ 10</span>
      </div>
      <div class="btn__edit--delete">
        <button class="btn__edit">Edit</button>
        <button class="btn__delete--one">Delete</button>
      </div>
    </li>
    `;
    containerWorkouts.insertAdjacentHTML('afterbegin', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);

    if (!workoutEl) return;

    this._hideForm();
    // this._hideFormEdit();

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workout);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    // console.log(data);

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _sortWorkouts() {
    if (this.sorted) {
      containerWorkouts.innerHTML = '';
      this.#workouts.forEach(workout => {
        this._renderWorkout(workout);
      });
    }

    if (!this.sorted) {
      const workoutsCopy = [...this.#workouts];
      workoutsCopy.sort((a, b) => a.rating - b.rating);

      containerWorkouts.innerHTML = '';
      workoutsCopy.forEach(workout => {
        this._renderWorkout(workout);
      });
    }

    this.sorted = !this.sorted;
  }

  _edit(e) {
    const btnEdit = e.target.closest('.btn__edit');
    if (!btnEdit) return;

    const workoutEl = btnEdit.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    if (!workout) return;
    this._hideForm();
    this._showFormEdit();
    // Populate the form with workout data for editing
    inputTypeEdit.value = workout.type;
    inputDistanceEdit.value = workout.distance;
    inputDurationEdit.value = workout.duration;
    inputRatingEdit.value = workout.rating;

    inputDistanceEdit.focus();

    // Save the workout object to a temporary variable for editing
    this.#editedWorkout = workout;
  }

  _editedWorkout(e) {
    e.preventDefault();

    if (
      !this._validateInputs(
        +inputDistanceEdit.value,
        +inputDurationEdit.value,
        +inputRatingEdit.value
      )
    )
      return alert('Inputs have to be positive numbers!');

    this.#editedWorkout.type = inputTypeEdit.value;
    this.#editedWorkout.distance = +inputDistanceEdit.value;
    this.#editedWorkout.duration = +inputDurationEdit.value;
    this.#editedWorkout.rating = +inputRatingEdit.value;

    this._setLocalStorage();
    location.reload();
  }

  _deleteWorkout(e) {
    const btnEdit = e.target.closest('.btn__delete--one');
    if (!btnEdit) return;

    const workoutEl = btnEdit.closest('.workout');
    if (!workoutEl) return;

    const workoutId = workoutEl.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      workout => workout.id === workoutId
    );

    if (workoutIndex === -1) return;

    // Remove the workout from the DOM
    // workoutEl.remove();

    // Remove the workout from the workouts array
    this.#workouts.splice(workoutIndex, 1);

    // Update local storage
    this._setLocalStorage();
    location.reload();
  }

  _validateInputs(...inputs) {
    const validInputs = inputs.every(inp => Number.isFinite(inp));
    const allPositive = inputs.every(inp => inp > 0);
    return validInputs && allPositive;
  }

  // _getLocalTime(timezone) {
  //   const options = {
  //     timeZone: timezone,
  //     hour: 'numeric',
  //     minute: 'numeric',
  //   };

  //   const localTime = new Date().toLocaleTimeString([], options);
  //   return localTime;
  // }

  _reset() {
    if (!confirm('Are you sure you want to delete all?')) return;
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
