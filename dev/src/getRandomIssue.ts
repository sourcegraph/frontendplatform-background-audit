import { setOutput, setFailed } from '@actions/core'
import { getOctokit } from '@actions/github'
import { Repository } from '@octokit/graphql-schema'
import type { Endpoints } from '@octokit/types'
import {config} from 'dotenv'
config()

export type Events = Endpoints['GET /repos/{owner}/{repo}/labels']['response']['data']

console.assert(process.env.REFINEMENT_BOT, 'REFINEMENT_BOT not present')
console.assert(process.env.TEAM, 'TEAM not present')

// get valus
const octokit = getOctokit(process.env.REFINEMENT_BOT as string)
const team = process.env.TEAM as string

const getIssues = async (): Promise<void> => {
    // step 1 get estimates;
    const result = await octokit.graphql<{ repository: Repository }>(`{
      repository(owner:"sourcegraph", name:"sourcegraph") {
        labels(first: 100, query: "estimate/") {
          nodes {
            name
          }
        }
      }
    }`)
    // generates a comma seperates list of every estiamte label
    let estimates: string | undefined
    try {
        estimates = result.repository.labels?.nodes?.map(item => item?.name).join(',')
        if (!estimates) {
            throw new Error('missing estimates')
        }
    } catch {
        console.log(JSON.stringify(result.repository.labels, null, 2))
        setFailed('unable to get estimate labels')
        return
    }

    // 2 week old tickets
    const age = parseInt(process.env.MINIMUM_AGE, 10) || 0;
    const date = new Date();
    date.setDate(date.getDate() - age);

    // step 2 get issues without estimates that are on ${team}
    const query = `repo:"sourcegraph/sourcegraph" is:issue is:open label:${team} -label:${estimates} -label:"sourcegraph-refinement-bot" sort:updated-desc no:assignee -label:tracking created:<=${date.toISOString()}`
    let issue = {}
    await octokit.paginate('GET /search/issues', { q: query, per_page: 1 }, (response, done) => {
        // get first one
        issue = response.data[0]
        done()
        return response.data
    })
    console.log('output set', issue)

    // exposed a variable for other actions to consume
    setOutput('issue', issue)
}

getIssues().then(
    () => {
        console.log('success')
    },
    () => {
        console.log('failure')
    }
)
