// The config page (without the already stored name / addess pairs)
module.exports = [
  // The google api key section
  {
    type: 'section',
    items: [
      // Description
      {
        type: 'heading',
        defaultValue: 'Google API key',
      },
      {
        type: 'text',
        defaultValue: 'This app needs your own free Google Maps Platform API key to look up addresses and routes (including public transport). Follow the <a href="https://github.com/Bradley5922/pebble-directions#setting-up-your-google-api-key">setup instructions</a> to create one, then paste it below.<br style="display:block">The key is kept on your phone and is only sent to Google when you request directions.',
      },
      {
        type: 'input',
        messageKey: 'googleApiKey',
        label: 'API key',
        description: 'Paste your Google Maps Platform API key here.',
        attributes: {
          placeholder: 'AIza...',
          limit: 120,
        },
      },
    ],
  },

  // The named addessses section
  {
    type: 'section',
    items: [
      // Description
      {
        type: 'heading',
        defaultValue: 'Favorite addresses',
      },
      {
        type: 'text',
        defaultValue: 'Favorite addresses allow you to quickly get to your favorite locations. For instance you could store your home address named \'home\'. Every time you search for a specified name, the app will automatically search for the address associated with it. You can add up to five of these addresses.<br style="display:block">This data is keep on your phone and never send to any external service.',
      },


      // Address #1
      {
        type: 'input',
        messageKey: 'namedAddressName_0',
        label: 'Name #1',
        description: 'Use a name that makes sense to you, such as \'home\', \'my college\' or \'mom\'.',
        attributes: {
          placeholder: 'e.g. home',
        },
      },
      {
        type: 'input',
        messageKey: 'namedAddressAddress_0',
        label: 'Address #1',
        description: 'The address should be as specific as possible. Something like \'Schleusenufer Kreuzberg, 10997 Berlin\'.',
        attributes: {
          placeholder: 'e.g. Schleusenufer',
        },
      },


      // Address #2
      {
        type: 'input',
        messageKey: 'namedAddressName_1',
        label: 'Name #2',
        attributes: {
          placeholder: 'e.g. home',
        },
      },
      {
        type: 'input',
        messageKey: 'namedAddressAddress_1',
        label: 'Address #2',
        attributes: {
          placeholder: 'e.g. Schleusenufer',
        },
      },


      // Address #3
      {
        type: 'input',
        messageKey: 'namedAddressName_2',
        label: 'Name #3',
        attributes: {
          placeholder: 'e.g. home',
        },
      },
      {
        type: 'input',
        messageKey: 'namedAddressAddress_2',
        label: 'Address #3',
        attributes: {
          placeholder: 'e.g. Schleusenufer',
        },
      },


      // Address #4
      {
        type: 'input',
        messageKey: 'namedAddressName_3',
        label: 'Name #4',
        attributes: {
          placeholder: 'e.g. home',
        },
      },
      {
        type: 'input',
        messageKey: 'namedAddressAddress_3',
        label: 'Address #4',
        attributes: {
          placeholder: 'e.g. Schleusenufer',
        },
      },


      // Address #5
      {
        type: 'input',
        messageKey: 'namedAddressName_4',
        label: 'Name #5',
        attributes: {
          placeholder: 'e.g. home',
        },
      },
      {
        type: 'input',
        messageKey: 'namedAddressAddress_4',
        label: 'Address #5',
        attributes: {
          placeholder: 'e.g. Schleusenufer',
        },
      },
    ],
  },

  // Submit / store settings button
  {
    type: 'submit',
    defaultValue: 'Save preferences',
  },

  // Api attribution stuff
  {
    type: 'section',
    items: [
      // Description
      {
        type: 'heading',
        defaultValue: 'Navigation data',
      },
      {
        type: 'text',
        defaultValue: 'Directions data, including public transport, is provided by the Google Directions API (https://developers.google.com/maps/documentation/directions).',
      },
    ],
  },
];
