import { App, ExpressReceiver } from '@slack/bolt'
import * as functions from 'firebase-functions'
import axios from 'axios'
import { BlockAction } from "@slack/bolt/dist/types/actions/block-action"
const fetch = require('node-fetch');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({keepAlive: true});
const httpsAgent = new https.Agent({keepAlive: true});

const agent = httpsAgent;
export interface PriorityItem {
    value: string
    name: string
}

export interface PrioritySlackValue {
    issue: string
    priority: string
}
export interface EstimateValue {
    issue: string
    estimate: string
}

// @ts-nocheck
// const config = functions.config();
require('dotenv').config()
// Initializes your app with your bot token and signing secret
const config = functions.config();
const expressReceiver = new ExpressReceiver({
    signingSecret: config.bot.slack_signing_secret as string,
    endpoints: '/events',
})

const app = new App({
    receiver: expressReceiver,
    token: config.bot.slack_bot_token as string,
})

app.command('/jason-testing', async ({ ack, say, client, body }) => {
    try {
        await ack()
        await say({
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "This is a section block with a button."
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Click Me"
                        },
                        "value": "click_me_123",
                        "action_id": "button"
                    }
                }
            ]
        })
    } catch (error) {
        console.log('err')
        console.error(error)
    }
})

app.view('view_1', async ({ ack, body, view, client, logger, payload, respond }) => {
    // Acknowledge the view_submission request
    await ack();
  
    console.log(JSON.stringify(payload, null, 2))
    // Do whatever you want with the input data - here we're saving it to a DB then sending the user a verifcation of their submission
  
    // Assume there's an input block with `block_1` as the block_id and `input_a`
    const user = body['user']['id'];
    // Message to send user
    let msg = '';
    // Save to DB  
    if (true) {
      // DB save was successful
      msg = 'Your submission was successful';
    } else {
      msg = 'There was an error with your submission';
    }
  
    // Message the user
    try {
        axios.post(payload.private_metadata, {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "WAKKA WAKKA." + Date.now()
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Click Me"
                        },
                        "value": "click_me_123",
                        "action_id": "button"
                    }
                }
            ]
        })
        await client.chat.postMessage({
            channel: user,
            text: msg
        });
    }
    catch (error) {
      logger.error(error);
    }
  
  });


app.action('button', async ({ ack, say, action, client, body }) => {
    try {
        await ack()
        
        const result = await client.views.open({
            // Pass a valid trigger_id within 3 seconds of receiving it
            trigger_id: (<BlockAction>body).trigger_id,
            // View payload
            view: {
              type: 'modal',
              // View identifier
              callback_id: 'view_1',
              private_metadata: (<BlockAction>body).response_url,
              title: {
                type: 'plain_text',
                text: 'Modal title'
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'Welcome to a modal with _blocks_'
                  },
                  accessory: {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Click me!'
                    },
                    action_id: 'button_abc'
                  }
                },
                {
                  type: 'input',
                  block_id: 'input_c',
                  label: {
                    type: 'plain_text',
                    text: 'What are your hopes and dreams?'
                  },
                  element: {
                    type: 'plain_text_input',
                    action_id: 'dreamy_input',
                    multiline: true
                  }
                }
              ],
              submit: {
                type: 'plain_text',
                text: 'Submit',
              }
            }
          });
    } catch (error) {
        console.log('err')
        console.error(error)
    }
    // Update the message to reflect the action
})
const generateLoader = (body: any) => {
    let clone = JSON.parse(JSON.stringify(body))
    const selects = clone.message.blocks.filter(
        (block: any) => !!(block.accessory && block.accessory.type == 'static_select')
    )
    selects.forEach(element => {
        delete element.accessory;
        element.text.text += ' :loading:'
    });
    return { blocks: clone.message.blocks};
}
const updateUrlIfChanged = async (issueNumber: string, channelId: string, messageTs: string) => {
    console.time('updateUrlIfChanged')
    // const issue = await axios.get(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${issueNumber}`, {
    //     headers: {
    //         Authorization: `token ${config.bot.refinement_token}`,
    //         Accept: 'application/vnd.github.symmetra-preview+json',
    //     },
    // })
    const response = await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${issueNumber}`, {
        method: 'GET',
        agent,
        headers: {
            Authorization: `token ${config.bot.refinement_token}`,
            Accept: 'application/vnd.github.symmetra-preview+json',
        },
    })
    const issue: any = await response.json();
    const { permalink } = await app.client.chat.getPermalink({ channel: channelId, message_ts: messageTs })
    const newString = `<refinement-bot>[refinement-slack-thread](${permalink})</refinement-bot>`
    const regex = /<refinement-bot>(.+)<\/refinement-bot>/

    // short circuit if it already contains the string
    if (issue.body.includes(newString)) {
        console.timeEnd('updateUrlIfChanged')
        return;
    }
    if (regex.test(issue.body)) {
        issue.body = issue.body.replace(/<refinement-bot>(.+)<\/refinement-bot>/, newString)
    } else {
        issue.body = issue.body.concat(`\n${newString}`)
    }
    await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify(issue.body),
        agent,
        headers: {
            Authorization: `token ${config.bot.refinement_token}`,
            Accept: 'application/vnd.github.symmetra-preview+json',
        },
    })
    // await axios.patch(
    //     `https://api.github.com/repos/sourcegraph/sourcegraph/issues/${issueNumber}`,
    //     { body: issue.data.body },
    //     {
    //         headers: {
    //             Authorization: `token ${config.bot.refinement_token}`,
    //             Accept: 'application/vnd.github.symmetra-preview+json',
    //         },
    //     }
    // )
    console.timeEnd('updateUrlIfChanged')
}

app.action('priority_select', async ({ ack, say, action: actionBase, respond, body: bodyBase }) => {
    await ack()

    // types seem to be off here...
    const body: any = bodyBase
    const action: any = actionBase
    const relevantBlock = body.message.blocks.find(
        (block: any) => block.accessory && block.accessory.action_id === action.action_id
    )
    let message = relevantBlock.text.text
    message = message.replace(/\n.+/, '')
    await respond((generateLoader(body)))

    const timestamp = `\`<!date^${parseInt(
        action.action_ts,
        10
    )}^{date_num} {time_secs}|Posted ${new Date().toLocaleString()}>\``
    message += `\n\`${body.user.username}\`: ${timestamp}`

    relevantBlock.text.text = message
    relevantBlock.block_id = `${Date.now()}`
    relevantBlock.accessory.initial_option = action.selected_option

    const json: PrioritySlackValue = JSON.parse(action.selected_option.value) as PrioritySlackValue
    // May redo this to traditional oauth flow
    // const labels = await axios.get(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
    //     headers: {
    //         Authorization: `token ${config.bot.refinement_token}`,
    //         Accept: 'application/vnd.github.symmetra-preview+json',
    //     },
    // })
    const response = await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
        method: 'GET',
        agent,
        headers: {
            Authorization: `token ${config.bot.refinement_token}`,
            Accept: 'application/vnd.github.symmetra-preview+json',
        },
    })
    const labels:any = await response.json();


    const priorityList: PriorityItem[] = JSON.parse(config.bot.priority_list as string) as PriorityItem[]
    // remove all active priorities

    const deleteLabels = async () => {
        console.time('deleteLabels')
        for (let c = 0; c < labels.length; c++) {
            const label = labels[c]
            const hasLabel = priorityList.some(item => item.value === label.name)
            if (hasLabel && label.name !== json.priority) {
                await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels/${encodeURIComponent(
                    label.name
                )}`, {
                    method: 'DELETE',
                    agent,
                    headers: {
                        Authorization: `token ${config.bot.refinement_token}`,
                        Accept: 'application/vnd.github.symmetra-preview+json',
                    },
                })


                // await axios.delete(
                //     `https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels/${encodeURIComponent(
                //         label.name
                //     )}`,
                //     {
                //         headers: {
                //             //'Authorization': `token ${process.env[`SLACK_USER_${body.user.username}`]}`,
                //             Authorization: `token ${config.bot.refinement_token}`,
                //             Accept: 'application/vnd.github.symmetra-preview+json',
                //         },
                //     }
                // )
            }
        }
        console.timeEnd('deleteLabels')
    }

    const updateLabels = async () => {
        // add priority
        console.time('updateLabels')
        // await axios.post(
        //     `https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`,
        //     { labels: [json.priority] },
        //     {
        //         headers: {
        //             //'Authorization': `token ${process.env[`SLACK_USER_${body.user.username}`]}`,
        //             Authorization: `token ${config.bot.refinement_token}`,
        //             Accept: 'application/vnd.github.symmetra-preview+json',
        //         },
        //     }
        // )
        await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
            method: 'POST',
            body: JSON.stringify({ 
                labels: [json.priority] 
            }),
            agent,
            headers: {
                Authorization: `token ${config.bot.refinement_token}`,
                Accept: 'application/vnd.github.symmetra-preview+json',
            },
        })
        console.timeEnd('updateLabels')
    }
      
    // update the message
    // console.log(JSON.stringify(bodyBase, null, 2))
    
    await Promise.all([
        deleteLabels(),
        updateLabels(),
        updateUrlIfChanged(json.issue, body.channel.id, body.message.ts),
    ])
    await respond({ blocks: body.message.blocks })
    console.log('done')
    // Update the message to reflect the action
})

//
app.action('estimate_select', async ({ ack, say, action: actionBase, respond, body: bodyBase }) => {
    await ack()

    // types seem to be off here...
    const body: any = bodyBase
    const action: any = actionBase

    const relevantBlock = body.message.blocks.find(
        (block: any) => block.accessory && block.accessory.action_id === action.action_id
    )

    let message = relevantBlock.text.text
    message = message.replace(/\n.+/, '')

    await respond((generateLoader(body)))

    const timestamp = `\`<!date^${parseInt(
        action.action_ts,
        10
    )}^{date_num} {time_secs}|Posted ${new Date().toLocaleString()}>\``
    message += `\n\`${body.user.username}\`: ${timestamp}`

    relevantBlock.text.text = message
    relevantBlock.block_id = `${Date.now()}`
    relevantBlock.accessory.initial_option = action.selected_option

    const json: EstimateValue = JSON.parse(action.selected_option.value) as EstimateValue

    // May redo this to traditional oauth flow
    // const labels = await axios.get(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
    //     headers: {
    //         Authorization: `token ${config.bot.refinement_token}`,
    //         Accept: 'application/vnd.github.symmetra-preview+json',
    //     },
    // })
    const response = await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
        method: 'GET',
        agent,
        headers: {
            Authorization: `token ${config.bot.refinement_token}`,
            Accept: 'application/vnd.github.symmetra-preview+json',
        },
    })
    const labels: any = await response.json();
    const deleteLabels = async () => {
        console.time('deleteLabels')
        // remove all active estimates
        for (let c = 0; c < labels.length; c++) {
            const label = labels[c]
            if (label.name.match(/^estimate\//) && label.name !== json.estimate) {
                await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels/${encodeURIComponent(
                    label.name
                )}`, {
                    method: 'DELETE',
                    agent,
                    headers: {
                        Authorization: `token ${config.bot.refinement_token}`,
                        Accept: 'application/vnd.github.symmetra-preview+json',
                    },
                })
            }
        }
        console.timeEnd('deleteLabels')
    }
    const updateLabels = async () => {
        // add priority
        console.time('updateLabels')
        await fetch(`https://api.github.com/repos/sourcegraph/sourcegraph/issues/${json.issue}/labels`, {
            method: 'POST',
            body: JSON.stringify( { 
                labels: [json.estimate] 
            }),
            agent,
            headers: {
                Authorization: `token ${config.bot.refinement_token}`,
                Accept: 'application/vnd.github.symmetra-preview+json',
            },
        })
        console.timeEnd('updateLabels')
    }

    // update the message
    // console.log(JSON.stringify(bodyBase, null, 2))
    
    await Promise.all([
        deleteLabels(),
        updateLabels(),
        updateUrlIfChanged(json.issue, body.channel.id, body.message.ts),
    ])
    await respond({ blocks: body.message.blocks })
    // Update the message to reflect the action
    // Update the message to reflect the action
})

// https://{your domain}.cloudfunctions.net/slack/events
exports.slack = functions.https.onRequest(expressReceiver.app)

// (async () => {
//   const port = 3000
//   // Start your app
//   await app.start(process.env.PORT || port);
//   console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
// })();
