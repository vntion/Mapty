'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in Km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/Km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // mkm/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([-7, 110], 5.2, 24, 178);
// const cycling1 = new Cycling([7, 120], 27, 95, 500);

///////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const contentWorkout = document.querySelector('.workout');
const btnDelete = document.querySelector('.btnDelete');
const errorMessage = document.querySelector('.errormsg');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    //  Get data from local storage
    this._getLocalStorage();

    // Attach event handler
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkouts.bind(this));
    btnDelete.addEventListener('click', this._deleteAllWorkouts.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Error');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel); // the second argument is zoom in and out map

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    this._toggleDeleteBtn();
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputElevation.value =
      inputCadence.value =
        '';

    // Hide form
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInput = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInput(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._errorMessage();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInput(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._errorMessage();

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Clear input fields + Hide form
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Show delete button
    this._toggleDeleteBtn();
  }

  _editWorkouts(e) {
    // cancel edit
    if (e.target.classList.contains('workout__btn--cancel'))
      return this._cancelEdit(e);

    // // klik ok
    if (e.target.classList.contains('workout__btn--ok'))
      return this._changeWorkout(e);

    //deleting workout
    if (e.target.classList.contains('workout__delete'))
      return this._deleteWorkout(e);

    // return if doesnt click edit btn
    if (!e.target.classList.contains('workout__edit')) return;

    // toggle edit
    this._toggleEditWorkouts(e);

    // toggle content editable
    this._toggleEditable(e);
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
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
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴'} ${workout.description}`
      )
      .openPopup();
    this.#markers.push(marker);
  }

  _deleteMarker(marker) {
    this.#map.removeLayer(marker);
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴'
        }</span>
        <span class="workout__value workout__value--distance">${
          workout.distance
        }</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value workout__value--duration">${
          workout.duration
        }</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value workout__value--pace">${workout.pace.toFixed(
              1
            )}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value workout__value--cadence">${
              workout.cadence
            }</span>
            <span class="workout__unit">spm</span>
          </div>
          <div class="workout__buttons hidden">
            <button class="workout__btn workout__btn--cancel">Cancel</button>
            <button class="workout__btn workout__btn--ok">OK</button>
          </div>

          <button class="workout__edit">Edit</button>
          <span class="workout__delete hidden">❌</span>
        </li>`;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value workout__value--speed">${workout.speed.toFixed(
            1
          )}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value workout__value--elevationGain">${
            workout.elevationGain
          }</span>
          <span class="workout__unit">m</span>
        </div>
        <div class="workout__buttons hidden">
            <button class="workout__btn workout__btn--cancel">Cancel</button>
            <button class="workout__btn workout__btn--ok">OK</button>
        </div>

        <button class="workout__edit">Edit</button>
        <span class="workout__delete hidden">❌</span>
      </li>`;
    }

    form.insertAdjacentHTML('afterend', html);

    // const editButtons = document.querySelectorAll('.workout__edit');
    // editButtons.forEach(button => {
    //   button.addEventListener('click', this._editWorkout.bind(this));
    // });
  }

  _moveToPopup(e) {
    const check = function (e) {
      return (
        e.target.classList.contains('workout__edit') ||
        e.target.classList.contains('workout__delete') ||
        e.target.classList.contains('workout__btn') ||
        (e.target.classList.contains('workout__value') &&
          e.target.classList.contains('edit'))
      );
    };

    if (check(e)) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); // JSON method convert object to string
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);

      if (work.type === 'running')
        Object.setPrototypeOf(work, Running.prototype);
      if (work.type === 'cycling')
        Object.setPrototypeOf(work, Cycling.prototype);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _errorMessage() {
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 3000);
  }

  _toggleEditWorkouts(e) {
    const targetWorkout = e.target.closest('.workout');

    const buttons = targetWorkout.querySelector('.workout__buttons');
    const deleteButton = targetWorkout.querySelector('.workout__delete');

    document
      .querySelectorAll('.workout__buttons, .workout__delete')
      .forEach(el => {
        if (el !== buttons && el !== deleteButton) el.classList.add('hidden');
      });

    deleteButton.classList.toggle('hidden');
    buttons.classList.toggle('hidden');

    // const buttons = e.target
    //   .closest('.workout')
    //   .querySelector('.workout__buttons');
    // const btnSiblings = e.target
    //   .closest('.workouts')
    //   .querySelectorAll('.workout__buttons');

    // const btnDelete = e.target
    //   .closest('.workout')
    //   .querySelector('.workout__delete');
    // const deleteSiblings = e.target
    //   .closest('.workouts')
    //   .querySelectorAll('.workout__delete');

    // btnSiblings.forEach(el => {
    //   if (el !== buttons) el.classList.add('hidden');
    // });
    // deleteSiblings.forEach(el => {
    //   if (el !== btnDelete) el.classList.add('hidden');
    // });

    // btnDelete.classList.toggle('hidden');
    // buttons.classList.toggle('hidden');
  }

  _toggleEditable(e) {
    const removeEditClass = function (workout) {
      workout.querySelectorAll('.workout__value').forEach(value => {
        value.classList.remove('edit');
      });
    };

    const toggleContentEditable = function (values, edit = true) {
      values.forEach(value => {
        value.contentEditable = edit;
      });
    };

    const targetWorkout = e.target.closest('.workout');
    const allWorkouts = e.target
      .closest('.workouts')
      .querySelectorAll('.workout');
    const allValues = targetWorkout.querySelectorAll('.workout__value');

    allWorkouts.forEach(workout => {
      if (workout !== targetWorkout) {
        removeEditClass(workout);
        toggleContentEditable(
          workout.querySelectorAll('.workout__value'),
          false
        );
      }
    });

    allValues.forEach(value => value.classList.toggle('edit'));

    const isEditable =
      targetWorkout.querySelector('.workout__value').isContentEditable;
    toggleContentEditable(allValues, !isEditable);
  }

  _cancelEdit(e) {
    const targetWorkout = e.target.closest('.workout');
    const allValues = targetWorkout.querySelectorAll('.workout__value');
    const workout = this.#workouts.find(
      work => work.id === targetWorkout.dataset.id
    );
    const distanceValue = targetWorkout.querySelector(
      '.workout__value--distance'
    );
    const durationValue = targetWorkout.querySelector(
      '.workout__value--duration'
    );

    allValues.forEach(el => {
      el.contentEditable = false;
      el.classList.remove('edit');
    });
    targetWorkout.querySelector('.workout__buttons').classList.add('hidden');
    targetWorkout.querySelector('.workout__delete').classList.add('hidden');

    // Set value back
    distanceValue.textContent = workout.distance;
    durationValue.textContent = workout.duration;

    if (workout.type === 'running') {
      const paceValue = targetWorkout.querySelector('.workout__value--pace');
      const cadenceValue = targetWorkout.querySelector(
        '.workout__value--cadence'
      );

      paceValue.textContent = workout.pace.toFixed(1);
      cadenceValue.textContent = workout.cadence;
    }

    if (workout.type === 'cycling') {
      const speedValue = targetWorkout.querySelector('.workout__value--speed');
      const elevGainValue = targetWorkout.querySelector(
        '.workout__value--elevationGain'
      );

      speedValue.textContent = workout.speed.toFixed(1);
      elevGainValue.textContent = workout.elevationGain;
    }
  }

  _deleteWorkout(e) {
    const targetWorkout = e.target.closest('.workout');
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === targetWorkout.dataset.id
    );
    const marker = this.#markers[workoutIndex];

    // delete workout from data
    this.#workouts.splice(workoutIndex, 1);
    this._setLocalStorage();

    // Update ui
    targetWorkout.remove();
    this._toggleDeleteBtn();
    this._deleteMarker(marker);
  }

  _toggleDeleteBtn() {
    this.#workouts.length > 0
      ? btnDelete.classList.remove('hidden')
      : btnDelete.classList.add('hidden');
  }

  _deleteAllWorkouts(e) {
    const targetWorkouts = e.target
      .closest('.sidebar')
      .querySelectorAll('.workout');

    if (!targetWorkouts) return;

    // Delete data
    this.#markers.forEach(mark => this._deleteMarker(mark));
    localStorage.removeItem('workouts');
    this.#workouts = [];
    this.#markers = [];

    // Update ui
    targetWorkouts.forEach(work => work.remove());
    this._toggleDeleteBtn();
  }

  _changeWorkout(e) {
    const validInput = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp >= -1);

    const targetWorkout = e.target.closest('.workout');
    const workout = this.#workouts.find(
      work => work.id === targetWorkout.dataset.id
    );
    const distance = +targetWorkout.querySelector('.workout__value--distance')
      .value;
    const duration = +targetWorkout.querySelector('.workout__value--duration')
      .value;

    if (workout.type === 'running') {
      const pace = +targetWorkout.querySelector('.workout__value--pace').value;
      const cadence = +targetWorkout.querySelector('.workout__value--cadence')
        .value;

      if (
        !validInput(distance, duration, pace, cadence) ||
        !allPositive(distance, duration, pace, cadence)
      )
        return this._errorMessage();

      workout.distance = distance;
      workout.duration = duration;
      workout.cadence = cadence;
      if (workout.pace === pace) workout.calcPace();
      else workout.pace = pace;
    }

    if (workout.type === 'cycling') {
      const speed = +targetWorkout.querySelector('.workout__value--speed')
        .value;
      const elevGain = +targetWorkout.querySelector(
        '.workout__value--elevationGain'
      ).value;

      if (
        !validInput(distance, duration, pace, cadence) ||
        !allPositive(distance, duration, speed, elevGain)
      )
        return this._errorMessage();

      workout.distance = distance;
      workout.duration = duration;
      workout.elevGain = elevGain;
      if (workout.speed === speed) workout.calcSpeed();
      else workout.speed = speed;
    }
  }
}

const app = new App();
