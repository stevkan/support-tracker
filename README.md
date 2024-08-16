# BFST Support Tracker Function

## Business logic for pulling issues

### Stack Overflow

| Monitored Tags           |
|:-------------------------|
| adaptive-cards           |
| azure-bot-service        |
| botframework             |
| direct-line-botframework |
| luis                     |
| qnamaker                 |
| web-chat                 |

### Internal Stack Overflow
| Monitored Tags       |
|:---------------------|
| azure-bot-service    |
| bot                  |
| bot-framework        |
| <span>luis.ai</span> |

### GitHub
| Organization | Repository                   | Labels        | Ignored Labels |
|:-------------|:-----------------------------|:-------------:|:--------------:|
| Microsoft    | botbuilder-azure             |               |                |
| Microsoft    | botbuilder-cognitiveservices |               |                |
| Microsoft    | botbuilder-dotnet            |               |                |
| Microsoft    | botbuilder-java              |               |                |
| Microsoft    | botbuilder-js                |               |                |
| Microsoft    | botbuilder-python            |               |                |
| Microsoft    | botbuilder-samples           |               |                |
| Microsoft    | botbuilder-tools             |               |                |
| Microsoft    | botbuilder-v3                |               |                |
| Microsoft    | botframework-cli             |               |                |
| Microsoft    | botframework-composer        |               |                |
| Microsoft    | botframework-emulator        |               |                |
| Microsoft    | botframework-directlinejs    |               |                |
| Microsoft    | botframework-solutions       | Support       |                |
| Microsoft    | botframework-services        |               |                |
| Microsoft    | botframework-sdk             |               | TeamsSDK       |
| Microsoft    | botframework-webchat         |               |                |
| MicrosoftDocs| bot-docs                     | team: support |                |

## Deployment
`https://docs.microsoft.com/en-us/azure/azure-functions/deployment-zip-push`  
`bash`  
`az login`  
`az functionapp deployment source config-zip -g botframeworksupporttrack -n BotFramework-Support-Tracker --src function.zip`

## Personal Access Token
https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page#create-a-pat

#### Note: The max PAT expiration is 1 year! PAT created on 7/23/20 by Kamran Iqbal.