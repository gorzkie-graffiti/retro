// API keys are not stored in this repository.
// Set them in back/config.json (git-ignored) or through the environment:
//   YT2009_INNERTUBE_API_KEY
//   YT2009_POT_API_KEY
const fs = require("fs")
const path = require("path")

function readConfig() {
    try {
        return JSON.parse(
            fs.readFileSync(path.join(__dirname, "config.json"), "utf8")
        )
    } catch {
        return {}
    }
}

const config = readConfig()

module.exports = {
    innertubeApiKey:
        process.env.YT2009_INNERTUBE_API_KEY || config.innertube_api_key || "",
    potApiKey: process.env.YT2009_POT_API_KEY || config.pot_api_key || ""
}
