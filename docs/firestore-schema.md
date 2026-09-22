# Firestore Database Schema — SIH26091

> AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant

---

## Collection: `/users/{userId}`

Top-level user profile document. One document per registered user.

| Field | Type | Required | Description |
|---|---|---|---|
| `displayName` | `string` | Yes | User's display name |
| `phone` | `string` | Yes | Phone number (primary auth for rural users, E.164 format) |
| `email` | `string` | No | Email address (optional, secondary auth) |
| `preferredLanguage` | `string` | Yes | ISO-639 language code (e.g., `hi`, `ta`, `bn`, `en`) |
| `socialCategory` | `string` | No | `SC` \| `ST` \| `OBC` \| `EWS` \| `GENERAL` |
| `tradeType` | `string` | No | PM-Vishwakarma trade (e.g., `carpenter`, `blacksmith`, `potter`) |
| `location` | `GeoPoint` | No | User's primary location (lat/lng) |
| `locationDescription` | `string` | No | Human-readable location (e.g., "Ranchi, Jharkhand") |
| `annualFamilyIncome` | `number` | No | Annual family income in INR (for scheme eligibility) |
| `aadhaarLinked` | `boolean` | No | Whether Aadhaar is linked (required for PM-DAKSH) |
| `deviceCapability` | `string` | No | `HIGH_SPEC` \| `LOW_SPEC` (cached from last session) |
| `totalEvaluations` | `number` | Yes | Count of evaluations run (denormalized for quick access) |
| `createdAt` | `Timestamp` | Yes | Account creation server timestamp |
| `updatedAt` | `Timestamp` | Yes | Last profile update server timestamp |

### Security Rules (recommended)

```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## Subcollection: `/users/{userId}/ideas/{ideaId}`

One document per business idea evaluation. Created by the `evaluate_business_idea` Cloud Function.

### Root Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `rawInput` | `string` | Yes | Original user transcript or typed text |
| `sourceLanguage` | `string` | Yes | ISO-639 language code of the raw input |
| `parsedOnDevice` | `boolean` | Yes | Whether on-device Gemma-2B was used for context parsing |
| `status` | `string` | Yes | `SUCCESS` \| `PARTIAL` \| `ERROR` |
| `errorMessage` | `string` | No | Error details if status is `PARTIAL` or `ERROR` |
| `evaluatedAt` | `Timestamp` | Yes | Server timestamp when evaluation completed |
| `modelVersion` | `string` | Yes | Pipeline version identifier (e.g., `"v1.0.0-langgraph"`) |

### Nested Map: `parsedInput`

Structured business dimensions produced by the orchestrator node.

| Field | Type | Description |
|---|---|---|
| `parsedInput.category` | `string` | Business category (e.g., `food_stall`, `tailoring`) |
| `parsedInput.subCategory` | `string` | Specific sub-category |
| `parsedInput.locationLat` | `number` | Latitude |
| `parsedInput.locationLng` | `number` | Longitude |
| `parsedInput.locationDescription` | `string` | Human-readable location |
| `parsedInput.monthlyRevenue` | `number` | Estimated monthly revenue (INR) |
| `parsedInput.monthlyCosts` | `number` | Estimated monthly costs (INR) |
| `parsedInput.monthlyFixedCosts` | `number` | Fixed costs (INR) |
| `parsedInput.pricePerUnit` | `number` | Price per unit (INR) |
| `parsedInput.variableCostPerUnit` | `number` | Variable cost per unit (INR) |
| `parsedInput.existingMonthlyDebt` | `number` | Monthly EMI (INR) |
| `parsedInput.existingLoanPrincipal` | `number` | Total loan principal (INR) |

### Nested Map: `market`

Hyperlocal market analysis from the scraper node.

| Field | Type | Description |
|---|---|---|
| `market.competitorDensity` | `number` | Competitors per km² |
| `market.nearestCompetitorM` | `number` | Distance to nearest competitor (meters) |
| `market.competitorNames` | `array<string>` | Names of nearby competitors |
| `market.totalCompetitors` | `number` | Total competitors found |
| `market.searchRadiusM` | `number` | Search radius used (meters) |

### Nested Map: `financial`

Financial metrics from the financial agent node.

| Field | Type | Description |
|---|---|---|
| `financial.dscr` | `number` | Debt Service Coverage Ratio |
| `financial.bepUnits` | `number` | Break-even point (units) |
| `financial.bepRevenue` | `number` | Break-even point (INR) |
| `financial.workingCapital` | `number` | Working capital (INR) |
| `financial.monthlyNetIncome` | `number` | Projected monthly net income (INR) |
| `financial.contributionMarginRatio` | `number` | Contribution margin ratio (0–1) |

### Array of Maps: `schemes`

Government scheme recommendations from the financial agent node.

| Field | Type | Description |
|---|---|---|
| `schemes[n].schemeName` | `string` | Scheme name (e.g., `PM-Vishwakarma`) |
| `schemes[n].eligible` | `boolean` | Eligibility status |
| `schemes[n].eligibilityReason` | `string` | Explanation of eligibility/ineligibility |
| `schemes[n].maxAmount` | `number` | Maximum loan/grant amount (INR) |
| `schemes[n].interestRate` | `string` | Interest rate (e.g., `"5%"`) |
| `schemes[n].portalUrl` | `string` | Official scheme portal URL |

### Nested Map: `risk`

Risk assessment from the validator node.

| Field | Type | Description |
|---|---|---|
| `risk.level` | `string` | `HIGH_RISK` \| `MODERATE_RISK` \| `LOW_RISK` |
| `risk.flags` | `array<string>` | Specific risk warnings |
| `risk.narrative` | `string` | LLM-generated risk summary |

### Security Rules (recommended)

```
match /users/{userId}/ideas/{ideaId} {
  // Users can read their own evaluations
  allow read: if request.auth != null && request.auth.uid == userId;
  // Only Cloud Functions can write (via Admin SDK, bypasses rules)
  allow write: if false;
}
```

---

## Recommended Composite Indexes

| Collection | Fields | Order | Purpose |
|---|---|---|---|
| `ideas` | `status`, `evaluatedAt` | ASC, DESC | Filter by status, sort by recency |
| `ideas` | `risk.level`, `evaluatedAt` | ASC, DESC | Filter high-risk ideas |
| `ideas` | `parsedInput.category`, `evaluatedAt` | ASC, DESC | Filter by business category |

---

## Data Lifecycle

1. **User Registration**: Client creates `/users/{userId}` on sign-up via Firebase Auth.
2. **Evaluation Request**: Client calls `evaluate_business_idea` HTTPS Callable.
3. **Document Creation**: Cloud Function creates `/users/{userId}/ideas/{ideaId}` with all evaluation data.
4. **Client Read**: Client reads the document using the `ideaId` returned in the callable response.
5. **History**: Users can query their `ideas` subcollection for past evaluations.
