// @ts-check
const core = require('@actions/core')
const fs = require('fs')
const axios = require('axios').default
const { parseXML, parseAtom, parseRss } = require('./parsers')
const { loadContent, close } = require('../puppeteer')
const {
  getDatabase,
  createSchema,
  insertCategory,
  insertSite,
  cleanup
} = require('./database')

/**
 *
 * @param {string} title
 * @param {string} url
 * @returns {Promise<import('./parsers').Site | null>}
 */
async function loadFeed(title, url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'llun/feeds' }
    })
    const xml = await parseXML(response.data)
    if (xml.rss) return parseRss(title, xml)
    if (xml.feed) return parseAtom(title, xml)
    return null
  } catch (error) {
    console.error(error.message)
    console.error(error.stack)
    return null
  }
}
exports.loadFeed = loadFeed

/**
 *
 * @param {string} opmlContent
 * @returns {Promise<any>}
 */
async function readOpml(opmlContent) {
  const input = await parseXML(opmlContent)
  const body = input.opml.body
  const outlines = body[0].outline
  return outlines.reduce((out, outline) => {
    const category = outline.$.title
    const items = outline.outline
    out.push({
      category,
      items: items && items.map((item) => item.$)
    })
    return out
  }, [])
}
exports.readOpml = readOpml

async function createFeedDatabase() {
  try {
    const feedsFile = core.getInput('opmlFile', { required: true })
    const opmlContent = fs.readFileSync(feedsFile).toString('utf8')
    const opml = await readOpml(opmlContent)

    // const database = getDatabase('public')
    // await createSchema(database)
    for (const category of opml) {
      const { category: title, items } = category
      console.log(`Load category ${title}, ${items.length}`)
      if (!items) continue
      // await insertCategory(database, title)
      for (const item of items) {
        const feedData = await loadFeed(item.title, item.xmlUrl)
        if (!feedData) {
          console.log('No feed data, continue to next item')
          continue
        }
        console.log(`Load ${feedData.title}`)
        // for (const entry of feedData.entries) {
        //   const link = entry.link
        //   console.log('Before loading content', link)
        //   const content = await loadContent(link)
        //   if (content) {
        //     console.log(`Puppenteer - ${entry.link}`)
        //     entry.content = content
        //     await close()
        //   }
        // }
        // await insertSite(database, title, feedData)
      }
    }
    console.log('Finished create feed database')
    // await cleanup(database)
    // await database.destroy()
  } catch (error) {
    console.log(error)
    console.error(error.message)
    console.error(error.stack)
    core.setFailed(error)
  }
}
exports.createFeedDatabase = createFeedDatabase
