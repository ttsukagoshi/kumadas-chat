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

// Gmail label name that Kumadas emails are labeled with
const KUMADAS_LABEL_NAME = 'クマダス';

// Kumadas Info object template
const KUMADAS_INFO_TEMPLATE = {
  datetime: new Date(), // 日時
  address: '***', // 住所
  type: '***', // 獣種
  quantity: 0, // 頭数
  situation: '***', // 状況
  url: '***', // クマダスURL https://kumadas.net/?lat=***&lng=***&radius=30
  position: {
    // 緯度経度のデフォルト値は秋田県河辺へそ公園
    lat: 39.6977777778,
    lng: 140.3594444444,
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
      /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hour>\d{2}):(?<minutes>\d{2})\r?\n住所：(?<address>[^\n]+?)\r?\n獣種：(?<type>[^\n]+?)\r?\n頭数：(?<quantity>\d+?)\r?\n状況：(?<situation>[\s\S]+?)\r?\n(?<url>https:\/\/kumadas\.net\/\?lat=(?<lat>[\d.]+?)&lng=(?<lng>[\d.]+?)&radius=\d+)/g;
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
          `${m.groups.year}-${m.groups.month}-${m.groups.day}T${m.groups.hour}:${m.groups.minutes}:09Z`,
        ),
        address: m.groups.address,
        type: m.groups.type,
        quantity: parseInt(m.groups.quantity, 10),
        situation: m.groups.situation,
        url: m.groups.url,
        position: {
          lat: parseFloat(m.groups.lat),
          lng: parseFloat(m.groups.lng),
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
   * Google Apps Script to get the user's Gmail thread with a specific label.
   *
   * @param {string} labelName The target label name.
   * @return {GoogleAppsScript.Gmail.GmailThread[]} An array of Gmail threads that match the label.
   */
  static getGmailThreadsWithLabel(labelName) {
    // log
    console.info(
      `[getGmailThreadsWithLabel] Getting threads with label: ${labelName}`,
    );
    const targetLabel = GmailApp.getUserLabelByName(labelName);
    if (!targetLabel) {
      throw new Error(`Label not found: ${labelName}`);
    }
    // const targetThreads = GmailApp.search(`label:${targetLabel.getName()}`);
    const targetThreads = GmailApp.search(
      `label:${targetLabel.getName()}`,
      0,
      10,
    );
    // log
    console.info(
      `[getGmailThreadsWithLabel] Found ${targetThreads.length} threads with label: ${labelName}`,
    );
    return targetThreads;
  }

  /**
   * Get Kumadas information from a Gmail thread and return the info as an array of JavaScript objects.
   *
   * @param {GoogleAppsScript.Gmail.GmailThread} gmailThread The Gmail thread to extract information from.
   * @return {Object[]} An array of objects containing the extracted Kumadas information.
   */
  static getKumadasInfoFromThread(gmailThread) {
    // log
    console.info(
      `[getKumadasInfoFromThread] Getting Kumadas info from thread: "${gmailThread.getFirstMessageSubject()}" (${gmailThread.getId()})`,
    );
    // Initialize an array to hold Kumadas information
    const kumadasInfos = [];
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
      kumadasInfos.push(this.convertKumadasMessage2Info(body));
    });
    return kumadasInfos;
  }
}

/**
 * Main function to execute the script.
 */
function main() {
  // Initialize an array to hold Kumadas information
  const kumadasInfoArr = [];
  // Get Gmail threads with the specified label
  const targetThreads = Helper.getGmailThreadsWithLabel(KUMADAS_LABEL_NAME);
  targetThreads.forEach((thread) => {
    // From each thread, get its messages.
    // Extract Kumadas information from the respective messages and add it to kumadasInfoArr
    const threadKumadasInfo = [...Helper.getKumadasInfoFromThread(thread)];
    kumadasInfoArr.push(...threadKumadasInfo);
  });
  console.log(JSON.stringify(kumadasInfoArr.flat(), null, 2));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Helper, main };
}
