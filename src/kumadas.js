//  Copyright 2025 ttsukagoshi (https://github.com/ttsukagoshi)

//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.

// 上記ライセンスは本ツールに係るものです。
// クマダスの情報は、必ずクマダス利用規約 https://kumadas.net/term を事前に確認・同意の上でご利用ください。

//////////////////////////////////////////////////////
// 定数 (ユーザが自身の環境に合わせて変更する必要がある) //
//////////////////////////////////////////////////////

const KUMADAS_LABEL_NAME = 'クマダス'; // クマダスからのメールにつけるGmailラベル名
const KUMADAS_PROCESSED_LABEL_NAME = 'クマダス_処理済み'; // クマダスからのメールのうち処理済みのものにつけるGmailラベル名

////////////////////////////////////
// 定数 (ユーザが変更する必要はない) //
////////////////////////////////////

const KUMADAS_INFO_TEMPLATE = {
  // Kumadas Info object template
  datetime: new Date(), // 日時
  address: '***', // 住所
  type: '***', // 獣種
  quantity: 0, // 頭数
  situation: '***', // 状況
  url: '***', // クマダスURL https://kumadas.net/?lat=***&lng=***&radius=30
  position: {
    // 緯度経度のデフォルト値は秋田県河辺へそ公園
    latitude: 39.6977777778,
    longitude: 140.3594444444,
  },
};

/**
 * Class for managing helper functions for this Google Apps Script project.
 */
class Helper {
  /**
   * Convert a Kumadas message body to a structured information object.
   * The structure of the Kumadas information object is defined by the KUMADAS_INFO_TEMPLATE.
   * The returning object is an array of Kumadas information objects,
   * since a Kumadas message can have multiple pieces of information,
   * or null if no valid information is found.
   *
   * @param {string} messageBody The body of the message to convert.
   * @return {any[] | null} The structured information object.
   */
  static convertKumadasMessage2Info(messageBody) {
    // log
    console.info(
      `[convertKumadasMessage2Info] Extracting Kumadas text from message body: ${messageBody}`,
    );
    // Regular expression to extract Kumadas text
    const kumadasRegex =
      /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hour>\d{2}):(?<minutes>\d{2})\r?\n住所：(?<address>[^\n]+?)\r?\n獣種：(?<type>[^\n]+?)\r?\n頭数：(?<quantity>\d+?)\r?\n状況：(?<situation>[\s\S]+?)\r?\n(?<url>https:\/\/kumadas\.net\/\?lat=(?<latitude>[\d.]+?)&lng=(?<longitude>[\d.]+?)&radius=\d+)/g;
    const matchArr = [...messageBody.matchAll(kumadasRegex)];
    if (matchArr.length === 0) {
      // If no match is found, log a warning and return null
      console.warn('[convertKumadasMessage2Info] No match found');
      return null;
    }
    const matchGroups = matchArr.map((m) => {
      return {
        ...KUMADAS_INFO_TEMPLATE,
        datetime: new Date(
          `${m.groups.year}-${m.groups.month}-${m.groups.day}T${m.groups.hour}:${m.groups.minutes}:00Z`,
        ),
        address: m.groups.address,
        type: m.groups.type,
        quantity: parseInt(m.groups.quantity, 10),
        situation: m.groups.situation.replace(/[\r\n]+/g, ' '), // 「状況」内の改行はスペースに置換しておく
        url: m.groups.url,
        position: {
          latitude: parseFloat(m.groups.latitude),
          longitude: parseFloat(m.groups.longitude),
        },
      };
    });
    // log
    console.info(
      `[convertKumadasMessage2Info] Extracted match groups: ${JSON.stringify(matchGroups, null, 2)}`,
    );
    return matchGroups;
  }

  /**
   * Convert degrees to radians.
   * @param {number} degrees The angle in degrees.
   * @returns {number} The angle in radians.
   */
  static degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Google Apps Script to get the user's Gmail thread with a specific label.
   *
   * @param {GoogleAppsScript.Gmail.GmailLabel} targetLabel The target label name.
   * @return {GoogleAppsScript.Gmail.GmailThread[]} An array of Gmail threads that match the label.
   */
  static getGmailThreadsWithLabel(targetLabel) {
    // label name
    const targetLabelName = targetLabel.getName();
    // log
    console.info(
      `[getGmailThreadsWithLabel] Getting threads with label: ${targetLabelName}`,
    );
    const targetThreads = GmailApp.search(`label:${targetLabelName}`);
    // log
    console.info(
      `[getGmailThreadsWithLabel] Found ${targetThreads.length} threads with label: ${targetLabelName}`,
    );
    return targetThreads;
  }

  /**
   * Calculate the great-circle distance between two points on the Earth
   * based on the haversine formula and returns the distance in kilometers.
   * The parameters `position1` and `position2` are JavaScript objects with `latitude` and `longitude` properties.
   *
   * @param {*} position1 The JavaScript object for the first position.
   * @param {*} position2 The JavaScript object for the second position.
   * @returns {number} The great-circle distance between the two positions in kilometers.
   * @see https://en.wikipedia.org/wiki/Haversine_formula for the formula
   * @see https://eco.mtk.nao.ac.jp/koyomi/wiki/CFC7C0B12FC8BEB7C2.html for the earth radius
   */
  static getGreatCircleDistance(position1, position2) {
    // log
    console.info(
      `[getGreatCircleDistance] Calculating distance between positions:\n` +
        ` position1: ${JSON.stringify(position1)}\n` +
        ` position2: ${JSON.stringify(position2)}`,
    );
    const earth_radius = 6378.137; // 地球の赤道半径 (km)
    const lat1 = this.degreesToRadians(position1.latitude);
    const lat2 = this.degreesToRadians(position2.latitude);
    const dLat = this.degreesToRadians(position2.latitude - position1.latitude);
    const dLon = this.degreesToRadians(
      position2.longitude - position1.longitude,
    );
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earth_radius * c; // Distance in kilometers
    // log
    console.info(
      `[getGreatCircleDistance] Distance calculated: ${distance} km`,
    );
    return distance;
  }

  /**
   * Get Kumadas information from a Gmail thread and return the info as an array of JavaScript objects.
   *
   * @param {GoogleAppsScript.Gmail.GmailThread} gmailThread The Gmail thread to extract information from.
   * @return {Object[]} A flattened array of objects containing the extracted Kumadas information.
   */
  static getKumadasInfoFromThread(gmailThread) {
    // log
    console.info(
      `[getKumadasInfoFromThread] Getting Kumadas info from thread: "${gmailThread.getFirstMessageSubject()}" (${gmailThread.getId()})`,
    );
    // Initialize an array to hold Kumadas information
    const kumadasInfosPre = [];
    // Get all messages in the thread
    const messages = gmailThread.getMessages();
    messages.forEach((message) => {
      // log
      console.info(
        `[getKumadasInfoFromThread] Getting Kumadas info from message: "${message.getSubject()}" (${message.getId()})`,
      );
      // Get the body of the message
      const body = message.getPlainBody();
      // Extract Kumadas-specific information from the body
      const kumadasInfo = this.convertKumadasMessage2Info(body);
      if (kumadasInfo) {
        // Add the extracted Kumadas info to the array only when kumadasInfo is not null
        kumadasInfosPre.push(kumadasInfo);
      }
    });
    // The final output should be a flat array of Kumadas information objects
    const kumadasInfos = kumadasInfosPre.flat();
    // log
    console.info(
      `[getKumadasInfoFromThread] Extracted Kumadas info: ${JSON.stringify(kumadasInfos, null, 2)}`,
    );
    return kumadasInfos;
  }

  /**
   * Calculate the distances between targetPosition and centerPosition
   * and determine whether the targetPosition is within the specified radius.
   * Returns true if the targetPosition is within the radius, false otherwise.
   *
   * @param {*} targetPosition A JavaScript object with the properties `latitude` and `longitude`
   * @param {*} centerPosition A JavaScript object with the properties `latitude` and `longitude`
   * @param {number} radius The radius of the range in kilometers
   * @returns {boolean} True if the targetPosition is within the radius, false otherwise.
   */
  static isWithinRange(targetPosition, centerPosition, radius) {
    // log
    console.info(
      `[isWithinRange] Checking if targetPosition is within range.\n` +
        ` targetPosition: ${JSON.stringify(targetPosition)}` +
        ` centerPosition: ${JSON.stringify(centerPosition)}` +
        ` radius: ${radius}`,
    );
    const distance = this.getGreatCircleDistance(
      targetPosition,
      centerPosition,
    );
    const isWithinRange = distance <= radius;
    // log
    console.info(
      `[isWithinRange] Distance ${distance} km is ${isWithinRange ? 'within' : 'out of'} range`,
    );
    return isWithinRange;
  }

  /**
   * Convert Kumadas information retrieved by this.getKumadasInfoFromThread into a text format
   * for sending to Google Chat.
   *
   * @param {object[]} kumadasInfos The Kumadas information object.
   * @returns {string} The formatted text for Google Chat.
   */
  static kumadasInfo2Text(kumadasInfos) {
    // log
    console.info(
      `[kumadasInfo2Text] Converting Kumadas info to text format: ${JSON.stringify(kumadasInfos, null, 2)}`,
    );

    const returnMessage = kumadasInfos
      .map((info) => {
        // Convert datetime into text in `yyyy-MM-dd HH:mm:ss` format
        return (
          `日時: ${info.datetime.toISOString().replace('T', ' ').substring(0, 19)}\n` +
          `住所: ${info.address}\n` +
          `獣種: ${info.type}\n` +
          `頭数: ${info.quantity}\n` +
          `状況: ${info.situation}\n` +
          `URL: ${info.url}`
        );
      })
      .join('\n\n');

    // log
    console.info(`[kumadasInfo2Text] Converted text: ${returnMessage}`);
    return returnMessage;
  }

  /**
   * Relabel a Gmail thread by removing an old label and adding a new label.
   * @param {GoogleAppsScript.Gmail.GmailThread} thread The Gmail thread to relabel.
   * @param {GoogleAppsScript.Gmail.GmailLabel} oldLabel The old label to remove.
   * @param {GoogleAppsScript.Gmail.GmailLabel} newLabel The new label to add.
   */
  static relabelGmailThread(thread, oldLabel, newLabel) {
    // log
    console.info(
      `[relabelGmailThread] Relabeling thread: ${thread.getId()}\n` +
        ` oldLabel: ${oldLabel.getName()}\n` +
        ` newLabel: ${newLabel.getName()}`,
    );
    // Remove the old label
    thread.removeLabel(oldLabel);
    // Add the new label
    thread.addLabel(newLabel);
    // log
    console.info(`[relabelGmailThread] Thread relabeled: ${thread.getId()}`);
  }

  /**
   * Send a message to Google Chat Space.
   * @param {string} chatSpaceWebhookUrl The webhook URL of the Google Chat Space.
   * @param {string} messageBody The message body to send.
   * @see https://developers.google.com/workspace/chat/quickstart/webhooks
   */
  static sendToChatSpace(chatSpaceWebhookUrl, messageBody) {
    // log
    console.info(
      `[sendToChatSpace] Sending message to Google Chat Space: ${messageBody}`,
    );
    // Send the message to Google Chat Space
    UrlFetchApp.fetch(chatSpaceWebhookUrl, {
      method: 'POST',
      contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify({
        text: messageBody,
      }),
    });
    // log
    console.info('[sendToChatSpace] Message sent to Google Chat Space');
  }
}

/**
 * Main function to execute the script.
 */
function main() {
  // log
  console.info(`[main] Starting main function`);
  // Get user-specified values in Script Properties
  const sp = PropertiesService.getScriptProperties().getProperties();
  const centerPosition = {
    // Center position
    latitude:
      parseFloat(sp.centerLatitude) || KUMADAS_INFO_TEMPLATE.position.latitude,
    longitude:
      parseFloat(sp.centerLongitude) ||
      KUMADAS_INFO_TEMPLATE.position.longitude,
  };
  // The radius in kilometers to determine whether a Kumadas info is within range
  const radius = parseFloat(sp.radiusKm) || 30; // Default radius is 30 km
  // Google Chat Space webhook URL
  const webhookUrl = sp.chatSpaceWebhookUrl;

  // Get the relevant Gmail label objects
  const targetLabel = GmailApp.getUserLabelByName(KUMADAS_LABEL_NAME);
  const processedLabel = GmailApp.getUserLabelByName(
    KUMADAS_PROCESSED_LABEL_NAME,
  );
  // Check the labels to see if they exist; if they don't, throw an error
  if (!targetLabel) {
    throw new Error(`Label not found: ${KUMADAS_LABEL_NAME}`);
  }
  if (!processedLabel) {
    throw new Error(`Label not found: ${KUMADAS_PROCESSED_LABEL_NAME}`);
  }

  // Get Gmail threads with the specified label
  const targetThreads = Helper.getGmailThreadsWithLabel(targetLabel);
  if (!targetThreads) {
    console.info(`No threads found with label: ${KUMADAS_LABEL_NAME}`);
    return;
  }
  targetThreads.forEach((thread) => {
    // From each thread, get its messages.
    // Extract Kumadas information from the respective messages and add it to kumadasInfoArr
    const threadKumadasInfo = Helper.getKumadasInfoFromThread(thread);
    if (threadKumadasInfo) {
      // Filter the values that are within the range
      // of the user-specified center position and radius
      const filteredKumadasInfo = threadKumadasInfo.filter((info) =>
        Helper.isWithinRange(info.position, centerPosition, radius),
      );
      if (filteredKumadasInfo.length === 0) {
        console.info(
          `No Kumadas info found within range for thread: ${thread.getId()}`,
        );
      } else {
        // Send chat message to the designated chat space
        const messageBody =
          '近隣でクマダス情報が発表されました：\n\n' +
          Helper.kumadasInfo2Text(filteredKumadasInfo);
        Helper.sendToChatSpace(webhookUrl, messageBody);
      }
      // Remove Gmail label KUMADAS_LABEL_NAME and relabel with KUMADAS_PROCESSED_LABEL_NAME
      Helper.relabelGmailThread(thread, targetLabel, processedLabel);
    }
  });
  // log
  console.info(`[main] Finished processing threads`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Helper, main };
}
