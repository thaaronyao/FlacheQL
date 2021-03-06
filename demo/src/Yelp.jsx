import React, { Component } from 'react';
import gql from 'graphql-tag';
import YelpBox from "./YelpBox.jsx";
import QueryTimer from './QueryTimer.jsx';
import Flache from '../flache';
import Form from './Form.jsx';
import YelpModal from './YelpModal.jsx';

class Yelp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      moreOptions: {
        price: false,  
        review_count: false,
        phone: false,
        distance: false,

      },
      yelpBoxes: [],
      flacheTimer : {
        reqStartTime: null,
        lastQueryTime: 'Please wait...',
        timerText: 'Last query fetched 0 results in',
      },
      flacheTimerClass: "timerF",
      activeModal: null
    };
    this.getRestaurants = this.getRestaurants.bind(this);
    this.handleMoreOptions = this.handleMoreOptions.bind(this);
    this.handleResponse = this.handleResponse.bind(this);
    this.buildBoxes = this.buildBoxes.bind(this);
    this.buildQuery = this.buildQuery.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.startTimer = this.startTimer.bind(this);
    this.endTimer = this.endTimer.bind(this);
    this.flashTimer = this.flashTimer.bind(this);
    this.showModal = this.showModal.bind(this);
    this.hideModal = this.hideModal.bind(this);
  } 
  
  componentDidMount() {
    /* initial modal render */
    this.showModal();
    const endpoint = 'http://www.flacheql.io:8000/yelp'
    const headers = { "Content-Type": "text/plain",
    "Authorization": "Bearer 1jLQPtNw6ziTJy36QLlmQeZkvvEXHT53yekL8kLN8nkvXudgTZ_Z0-VVjBOf483Flq-WDxtD2jsuwS8qkpkFa08yOgEAKIchAk2RI-avamh9jxGyxhPxgyKRbgIwW3Yx", }
    const options = {
      paramRetrieval: true,
      fieldRetrieval: true,
      cacheExpiration: 1000 * 120,
      subsets: {
        location: "=",
        limit: "limit"
      },
      pathToNodes: "data.search.business"
    }
    // ---- INIT FLACHE CLIENT ----
    this.cache = new Flache(endpoint, headers, options);
    setTimeout(() => {
      this.getRestaurants('Venice', 20, ['']);
    }, 100);
  }

  /* Modal Display */
  hideModal() {
    this.setState({ activeModal: null })
  }

  showModal() {
    this.setState({ activeModal: YelpModal });
  }  

  onKeyDown(e) {
    if (e.keyCode === 27) this.hideModal();
  }

  getRestaurants(location, limit, extraFields) {
    const variables = {
      location, 
      limit,
    }
    const flacheQuery = this.buildQuery(location, limit, true, extraFields);
    // start apollo timer
    this.startTimer(false, limit);
    // start flache timer
    this.startTimer(true, limit);
    // launch flache query
    this.cache.it(flacheQuery, variables)
      .then((res) => {
        return this.handleResponse(res.data, true)
      });
  }

  /**
  * Compiles a GraphQL query string tailored to the engine it's intended for
  * @param {string} location The location to retrieve from
  * @param {number} limit The number of results to fetch, entered by the user in an input box
  * @param {boolean} flache Determines which cache engine to build for, true for Flache, false for Apollo
  * @param {array} extraFields An array containing information on which checkbokes are ticked
  * @returns {string}
  */
  buildQuery(location, limit, flache, extraFields) {
    if (!limit || limit === 0) return window.alert('Bad query! You must enter a number to search for.');
    if (!location || location === '') return window.alert('Bad query! You must enter a limit (less than 50).')
    if (limit > 50) return window.alert('Bad query! Max 50 results!');
    let str = '';
    extraFields.forEach(e => str += '\n' + e);
    location = '"' + location + '"'
    if (flache) {
      return ( `{
      search(location: ${location} limit: ${limit}) {
        business {
          name
          rating
          hours {
            is_open_now
          }
          categories {
            title
          }
          ${str}
        }
      }
    }`);
  }
  }

  handleMoreOptions() {
    const saveOptions = [];
    const updateOptions = {};
    const options = document.getElementsByClassName('searchOptions');
    for (let i = 0; i < options.length; i++) {
      if (options[i].checked) {
        saveOptions.push(options[i].value);
        updateOptions[options[i].value] = [true, options[i].value];
      } else updateOptions[options[i].value] = false;
    }
    this.setState({ moreOptions: updateOptions });
    return saveOptions;
  }

  handleResponse(data, flache) {
    this.endTimer(flache, data.search.business.length);
    this.buildBoxes(data);
  }

  buildBoxes(data) {
    const newBoxes = data.search.business.map((business, index) => {
      // yelp often does not return a business' hours, but still returns an empty hours array anyway
      const hours = business.hours[0] ? (business.hours[0].is_open_now ? 'yes' : 'no') : 'no info';
      return (
        <YelpBox
          key={`b${index}`}
          name={business.name}
          rating={business.rating}
          hours={hours}
          categories={business.categories}
          price={business.price}
          distance={business.distance}
          review_count={business.review_count}
          phone={business.phone}
          moreOptions={this.state.moreOptions}
        />
      );
    });
    this.setState({ yelpBoxes: newBoxes });
  }

  startTimer(flache, limit) {
    const reqStartTime = window.performance.now();
    const updatedTimer = { timerText: `Fetching ${limit} items...`, reqStartTime, lastQueryTime: 'Please wait...' };
    // update either the flache or apollo timer
    if (flache) this.setState({ flacheTimer: updatedTimer });
  }

  endTimer(flache, limit) {
    const lastQueryTime = flache ? `${window.performance.now() - this.state.flacheTimer.reqStartTime} ms` : `${window.performance.now() - this.state.apolloTimer.reqStartTime} ms`;
    const updatedTimer = { timerText: `Last query fetched ${limit} results in`, lastQueryTime, reqStartTime: null };
    // update either the flache or apollo timer
    if (flache) this.setState({ flacheTimer: updatedTimer });
    this.flashTimer(flache);
  }

  // simple flash effect for timer
  flashTimer(flache) {
    if (flache) {
      this.setState({ flacheTimerClass: "timerF flashF" });
      setTimeout(() => this.setState({ flacheTimerClass: "timerF" }), 200);
    }
  }

  /** Fired on search, collects input fields and calls getRepos */
  handleSubmit() {
    const extraFields = this.handleMoreOptions();
    this.getRestaurants(
      document.getElementById('location').value,
      Number(document.getElementById('limit').value),
      extraFields,
    );
  }

  render() {
    return (
      <div className="main-container">
        {/* Modal Control */}
        {this.state.activeModal === YelpModal ? 
          <YelpModal isOpen={this.state.activeModal} onClose={this.hideModal} onKeyDown={(e) => this.onKeyDown(e)}>
            <p>Modal</p>
          </YelpModal>
          : <div></div>}
        {/* Document Body */}
        <div id="top-wrapper">
          <Form
            showModal={this.showModal}
            onClose={this.hideModal}
            onKeyDown={(e) => this.onKeyDown(e)}
            handleSubmit={this.handleSubmit}
            title={'Search Yelp'}
            fields={[
              { label: 'Location: ', id: 'location' },
              { label: '# to fetch: ', id: 'limit' },
            ]}
            extras={[
              { label: ' Price', id: 'price' },
              { label: ' Review Count', id: 'review_count' },
              { label: ' Distance from location', id: 'distance' },
              { label: ' Phone number', id: 'phone' },
            ]}
          />
          <div id="timer-wrapper">
            <QueryTimer
              class={this.state.flacheTimerClass}
              title="FlacheQL"
              lastQueryTime={this.state.flacheTimer.lastQueryTime}
              timerText={this.state.flacheTimer.timerText}
            />
          </div>
        </div>
        <div className="result-list">
          {this.state.yelpBoxes}
        </div>
      </div>
    )
  }
}

export default Yelp;
