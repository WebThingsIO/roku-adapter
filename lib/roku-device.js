/**
 * Roku device type.
 */
'use strict';

const {Device} = require('gateway-addon');
const RokuProperty = require('./roku-property');
const {keys} = require('roku-client');

const POLL_INTERVAL = 5000;

/**
 * Roku device type.
 */
class RokuDevice extends Device {
  /**
   * Initialize the object.
   *
   * @param {Object} adapter - RokuAdapter instance
   * @param {Object} client - Roku client object
   * @param {Object} info - Fetched device information
   */
  constructor(adapter, client, info) {
    const id = `roku-${info.deviceId}`;
    super(adapter, id);

    this.client = client;
    this.info = info;

    this.name = info.friendlyDeviceName;
    this.description = info.friendlyModelName;
    this['@context'] = 'https://iot.mozilla.org/schemas';
    this['@type'] = [];

    this.promises = [];

    this.promises.push(
      this.client.active().then((app) => {
        this.properties.set(
          'activeApp',
          new RokuProperty(
            this,
            'activeApp',
            {
              label: 'Active App',
              type: 'string',
              readOnly: true,
            },
            app ? app.name : null,
          )
        );
      })
    );

    this.addAction(
      'sendText',
      {
        label: 'Send Text',
        input: {
          type: 'string',
        },
      }
    );

    this.addAction(
      'sendKeypress',
      {
        label: 'Send Keypress',
        input: {
          type: 'string',
          enum: Array.from(
            new Set(Object.values(keys).map((k) => k.command).filter((k) => {
              if ((k.startsWith('Volume') ||
                   k.startsWith('Channel') ||
                   k.startsWith('Input') ||
                   k === 'Power') &&
                  this.info.isTv !== 'true') {
                return false;
              }

              if (k === 'FindRemote' &&
                  this.info.supportsFindRemote !== 'true') {
                return false;
              }

              return true;
            }))
          ).sort(),
        },
      }
    );

    this.promises.push(
      this.client.apps().then((apps) => {
        this.apps = apps;
        this.addAction(
          'launchApp',
          {
            label: 'Launch App',
            input: {
              type: 'string',
              enum: apps.map((a) => a.name).sort(),
            },
          }
        );
      })
    );

    if (this.info.isTv === 'true') {
      this.addAction(
        'tuneToChannel',
        {
          label: 'Tune to Channel',
          input: {
            type: 'string',
          },
        }
      );
    }

    setInterval(this.updateApp.bind(this), POLL_INTERVAL);
  }

  /**
   * Update the current app.
   */
  updateApp() {
    this.client.active().then((app) => {
      const prop = this.properties.get('activeApp');
      if ((!app && prop.value !== app) ||
          (app && prop.value !== app.name)) {
        prop.setCachedValue(app.name);
        this.notifyPropertyChanged(prop);
      }
    }).catch(() => {
      // pass
    });
  }

  /**
   * Perform an action.
   *
   * @param {Object} action - Action to perform
   */
  performAction(action) {
    switch (action.name) {
      case 'tuneToChannel':
        action.start();
        return this.client.launchDtv(action.input).then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to tune to channel: ${e}`);
          action.status = 'error';
          this.actionNotify(action);
        });
      case 'launchApp': {
        action.start();

        const app = this.apps.filter((a) => a.name === action.input);
        if (app.length === 0) {
          console.error(`App not found: ${action.input}`);
          action.status = 'error';
          this.actionNotify(action);
          return;
        }

        return this.client.launch(app[0].id).then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to launch app: ${e}`);
          action.status = 'error';
          this.actionNotify(action);
        });
      }
      case 'sendKeypress': {
        action.start();

        const key = Object.values(keys).filter((k) => {
          return k.command === action.input;
        });
        if (key.length === 0) {
          console.error(`Key not found: ${action.input}`);
          action.status = 'error';
          this.actionNotify(action);
          return;
        }

        return this.client.keypress(key[0]).then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to send keypress: ${e}`);
          action.status = 'error';
          this.actionNotify(action);
        });
      }
      case 'sendText':
        action.start();
        return this.client.text(action.input).then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to send text: ${e}`);
          action.status = 'error';
          this.actionNotify(action);
        });
      default:
        action.status = 'error';
        this.actionNotify(action);
        return Promise.resolve();
    }
  }
}

module.exports = RokuDevice;
