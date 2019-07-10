const puppeteer = require('puppeteer')
const chalk = require('chalk')
const dotenv = require('dotenv')
dotenv.config()
let portMappings = JSON.parse(process.env.PORT_MAPPINGS)
let takeScreenshots = process.env.SCREENSHOTS === 'true';

(async () => {
  console.log(chalk.cyan(asciify('Centurylink Port Forwarding Fixer', 1)))
  console.log('Wanted port mappings:', portMappings)
  console.log(chalk.grey('Opening browser...'))
  const browser = await puppeteer.launch()
  try {
    const page = await browser.newPage()
    page.setViewport({ width: 1200, height: 1200})
    console.log(chalk.grey('Opening router admin page...'))

    await page.goto(process.env.ROUTER_LOGIN)
    takeScreenshots && await page.screenshot({ path: 'screens/1-login-page.png' })
    await page.click('input[name=admin_username]')
    await page.keyboard.type(process.env.ROUTER_USER)
    await page.click('input[name=admin_password].textinput')
    await page.keyboard.type(process.env.ROUTER_PASS)
    takeScreenshots && await page.screenshot({ path: 'screens/2-login-page-filled.png' })
    console.log(chalk.grey('Logging in...'))
    await page.click('#apply_btn')
    await page.waitForNavigation()
    takeScreenshots && await page.screenshot({ path: 'screens/3-logged-in.png' })
    console.log(chalk.grey('Opening port forwarding page...'))
    await page.goto(`${process.env.ROUTER_LOGIN}/advancedsetup_advancedportforwarding.html`)
    takeScreenshots && await page.screenshot({ path: 'screens/4-port-forwarding.png' })

    for (let wantedMapping of portMappings) {
      const wantedString = wantedMapping.ip + ':' + wantedMapping.port + ' (' + wantedMapping.protocol + ')'
      process.stdout.write(chalk.cyan(`\nSetting up rule ${wantedString}...`))
      const currentPorts = await getCurrentPortMappings(page)
      const matchingRule = currentPorts.find(currentMapping => currentMapping.ip === wantedMapping.ip && currentMapping.port === wantedMapping.port)
      if (matchingRule) {
        process.stdout.write(chalk.red(`\n - Need to delete before continuing...`))
        await page.evaluate((index) => {
          removeClick(index)
        }, matchingRule.index)
        takeScreenshots && await page.screenshot({ path: `screens/5-remove-${wantedString}-click.png` })
        await page.waitForNavigation() // loading screen
        takeScreenshots && await page.screenshot({ path: `screens/6-removed-${wantedString}.png` })
        await page.waitForNavigation() // back to port forwarding
        takeScreenshots && await page.screenshot({ path: `screens/7-reloaded-${wantedString}.png` })
        process.stdout.write(chalk.green(` Deleted!`))
      }
      process.stdout.write(chalk.yellow(`\n - Adding rule...`), wantedMapping)
      await page.select('#select_device', wantedMapping.ip)
      await page.click('#iStart')
      await page.keyboard.type(wantedMapping.port)
      await page.click('#iEnd')
      await page.keyboard.type(wantedMapping.port)
      await page.select('#proto', wantedMapping.protocol)
      takeScreenshots && await page.screenshot({ path: `screens/8-ready-for-save-${wantedString}.png` })
      await page.click('.apply_btn')
      await page.waitForNavigation()
      takeScreenshots && await page.screenshot({ path: `screens/9-saved-${wantedString}.png` })
      process.stdout.write(chalk.green(` Added!\n`))
    }
    console.log("\n" + chalk.green(`Done!`))
  } catch (err) {
    browser && browser.close()
    throw err
  }
  browser && browser.close()

})().catch(err => {
  // Swallow cancelation errors
  if (err && err.message === 'canceled') return
    console.error(err)
})


async function getCurrentPortMappings(page) {
  return await page.evaluate(() => {
    return [...document.querySelectorAll('form[name=PortForwarding] tr[align=center]')].map((row, index) => {
      const cells = [...row.querySelectorAll('td')].map(cell => cell.innerText)
      return {ip: cells[0], protocol: cells[1], port: cells[2], index }
    })
  })
}
/**
 * Duplicates a character a number of times
 * @param  {string} char   Character or string to duplicate
 * @param  {number} length Number of times to duplicate the input string
 * @return {string}        Character duplicated n number of times
 */
function repeat(char, length) {
  let str = ''
  for (let i=0; i<length; i++) {
    str += char
  }
  return str
}

/**
 * Wrap a string in nice, neat rows of asterisks
 * @param  {string} string  Content to asciify
 * @param  {number} padding Multiplier for how much padding to use
 * @return {string}         Multi-line string with padding and a border added
 */
function asciify(string, padding) {
  let horizontalStretch = 5
  let char = '*'
  let border = repeat(char, string.length + padding * horizontalStretch * 2 + 2)
  let gap = char + repeat(' ', string.length + padding * horizontalStretch * 2) + char
  let result = []
  result.push(border)
  for (let i=0; i<padding; i++) {
    result.push(gap)
  }
  result.push(char + repeat(' ', padding * horizontalStretch) + string + repeat(' ', padding * horizontalStretch) + char)
  for (let i=0; i<padding; i++) {
    result.push(gap)
  }
  result.push(border)
  return result.join('\n')
}