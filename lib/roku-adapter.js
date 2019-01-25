/**
 * Roku adapter.
 */
'use strict';

const {Adapter} = require('gateway-addon');
const {Client} = require('roku-client');
const RokuDevice = require('./roku-device');

/**
 * Adapter for Roku devices.
 */
class RokuAdapter extends Adapter {
  /**
   * Initialize the object.
   *
   * @param {Object} addonManager - AddonManagerProxy object
   * @param {Object} manifest - Package manifest
   */
  constructor(addonManager, manifest) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);

    this.knownDevices = new Set();
    this.config = manifest.moziot.config;

    this.pairing = false;
    this.addKnownDevices();
    this.startPairing();
  }

  /**
   * Attempt to add any configured devices.
   */
  addKnownDevices() {
    for (const addr of this.config.devices) {
      if (!/^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(addr)) {
        continue;
      }

      this.knownDevices.add(addr);

      const client = new Client(addr);
      client.info().then((info) => {
        const dev = new RokuDevice(this, client, info);
        Promise.all(dev.promises).then(() => {
          this.handleDeviceAdded(dev);
        }).catch((e) => {
          console.error(`Failed to create device: ${e}`);
        });
      }).catch((e) => {
        console.error(`Could not connect to ${addr}: ${e}`);
      });
    }
  }

  /**
   * Start the discovery process.
   */
  startPairing() {
    if (this.pairing) {
      return;
    }

    this.pairing = true;
    Client.discoverAll().then((clients) => {
      for (const client of clients) {
        if (this.knownDevices.has(client.ip)) {
          continue;
        }

        client.info().then((info) => {
          const dev = new RokuDevice(this, client, info);
          Promise.all(dev.promises).then(() => {
            this.handleDeviceAdded(dev);
          }).catch((e) => {
            console.error(`Failed to create device: ${e}`);
          });
        }).catch((e) => {
          console.error(`Could not connect to ${client.ip}: ${e}`);
        });
      }

      this.pairing = false;
    }).catch((e) => {
      console.error(`Discovery failed: ${e}`);
    });
  }

  /**
   * Cancel the pairing process.
   */
  cancelPairing() {
    this.pairing = false;
  }

  /**
   * Remove a device from this adapter.
   *
   * @param {Object} device - The device to remove
   * @returns {Promise} Promise which resolves to the removed device.
   */
  removeThing(device) {
    this.knownDevices.delete(device.client.ip);
    if (this.devices.hasOwnProperty(device.id)) {
      this.handleDeviceRemoved(device);
    }

    return Promise.resolve(device);
  }
}

module.exports = RokuAdapter;
