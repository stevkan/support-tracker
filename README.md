# Support Tracker

## Business logic for pulling issues

### Stack Overflow
**Monitored Tags:**
- adaptive-cards
- azure-bot-service
- botframework
- direct-line-botframework
- luis
- qnamaker
- web-chat

### Internal Stack Overflow
**Monitored Tags:**
- azure-bot-service
- bot
- bot-framework
- luis.ai

### GitHub
**Monitored Microsoft/MicrosoftDocs Repositories:**
- botbuilder-azure
- botbuilder-cognitiveservices
- botbuilder-dotnet
- botbuilder-java
- botbuilder-js
- botbuilder-python
- botbuilder-samples
- botbuilder-tools
- botbuilder-v3
- botframework-cli
- botframework-composer
- botframework-emulator
- botframework-directlinejs
- botframework-solutions (Tag: Support)
- botframework-services
- botframework-sdk (Ignored Tag: TeamsSDK)
- botframework-webchat
- bot-docs team (Tag: support, Org: MicrosoftDocs)

---

### Environment Variables
| Variable Name | Description |
| --- | --- |
| `AZURE_DEVOPS_ORG`  | Azure DevOps Organization |
| `AZURE_DEVOPS_PROJECT` | Azure DevOps Project |
| `AZURE_DEVOPS_API_VERSION` | Azure DevOps API Version |
| `APPINSIGHTS_INSTRUMENTATION_KEY` | Application Insights Instrumentation Key |
| `GITHUB_TOKEN` | GitHub Token |
| `GITHUB_API_URL` | GitHub API URL |
| `STACK_OVERFLOW_ENTERPRISE_KEY` | Stack Overflow Enterprise Key |

### Command Line Arguments
| Argument | Description |
| --- | --- |
| `help` | Display help information |
| `help <command>` | Display help information for a specific command |
| `get-params` | Get the current parameters for the application |
| `set-params` | Set the current parameters for the application |
| `set-use-test-data` | Enables/disables the use of test data [Default: false] |
| `set-username` | Set the Azure DevOps username |
| `set-pat` | Set the Azure DevOps Personal Access Token |

Example: `npm start set-params 4 12`: Sets the number of days to pull issues for and the time of day at which to stop pulling issues. For instance, given the above parameters, the application will pull issues for the last 4 days and stop pulling issues at 12:00 PM of the 4th day.

### Building the application
```
npm install
```

```
npm run build
```

### Running the application
```
npm start
```

### Adjusting test data options
In each service (Stack Overflow, Azure DevOps, GitHub), located in the `getIssues()` method, there are data sets represented by both the `emptyData` and `testData` variables. Either of these can be edited and/or assigned as the mock data used to simulate the responses from the services. This is enabled via the `set-use-test-data` command line argument.