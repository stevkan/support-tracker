const SUPPORT = "support";
const DOCS_SUPPORT = "team: support"
const TEAMS_SDK = "TeamsSDK";

/**
 * Defines the configuration for the Stack Overflow data source, including the relevant tags and the source name.
 */
const StackOverflow = {
  tags: [
    "adaptive-cards",
    "azure-bot-service",
    "botframework",
    "direct-line-botframework",
    // "luis", // is now...
    "azure-language-understanding",
    // "qnamaker",
    "web-chat",
    "microsoft-agent",
    "teams-ai",
    "azure-agent",
    "microsoft-copilot",
    "copilot-for-m365",
    "teams-toolkit"
  ],
  source: 'Stack Overflow'
};

/**
 * Defines the configuration for the internal Stack Overflow data source, including the relevant tags and the source name.
 */
const InternalStackOverflow = {
  tags: [
    "azure-bot-service",
    "bot",
    "bot-framework", 
    "luis.ai"
  ],
  source: 'Stack Overflow Internal'
}

/**
 * Defines the configuration for the GitHub data source, including a list of relevant repositories and their labels.
 */
const GitHub = {
  repositories: [
    // { org: "Microsoft", repo: "botbuilder-azure" },
    // { org: "Microsoft", repo: "botbuilder-cognitiveservices" },
    // { org: "Microsoft", repo: "botbuilder-dotnet" },
    // { org: "Microsoft", repo: "botbuilder-java" },
    // { org: "Microsoft", repo: "botbuilder-js" },
    // { org: "Microsoft", repo: "botbuilder-python" },
    // { org: "Microsoft", repo: "botbuilder-samples" },
    { org: "Microsoft", repo: "agents" },
    { org: "Microsoft", repo: "agents-for-net" },
    { org: "Microsoft", repo: "agents-for-js" },
    { org: "Microsoft", repo: "agents-for-python" },
    // { org: "Microsoft", repo: "botbuilder-tools" },
    // { org: "Microsoft", repo: "botbuilder-v3" },
    // { org: "Microsoft", repo: "botframework-cli" },
    // { org: "Microsoft", repo: "botframework-composer" },
    // { org: "Microsoft", repo: "botframework-emulator" },
    // { org: "Microsoft", repo: "botframework-directlinejs" },
    // { org: "Microsoft", repo: "botframework-solutions", labels: [SUPPORT] },
    // { org: "Microsoft", repo: "botframework-services" },
    // { org: "Microsoft", repo: "botframework-sdk", ignoreLabels: [TEAMS_SDK] },
    // { org: "Microsoft", repo: "botframework-webchat" },
    // { org: "MicrosoftDocs", repo: "bot-docs", labels: [ DOCS_SUPPORT ] }
  ],
  source: 'GitHub'
}

export { GitHub, InternalStackOverflow, StackOverflow };