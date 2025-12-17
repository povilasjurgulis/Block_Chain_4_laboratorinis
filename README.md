## Verslo modelis ir logika

### Verslo modelio idėja

Šis projektas įgyvendina **freelance eskrovo** (angl. *freelance escrow*) verslo modelį.  
Tikslas – užtikrinti, kad užsakovas (klientas) ir laisvai samdomas darbuotojas (freelanceris) galėtų saugiai atsiskaityti už darbus, o ginčo atveju sprendimą priimtų trečia, neutrali šalis – **arbitras**.

Lėšos už darbą nėra siunčiamos tiesiogiai freelancer‘iui – jos pirmiausia pervedamos į išmaniąją sutartį ir „užšaldomos“ iki tol, kol darbas patvirtinamas arba išsprendžiamas ginčas.

### Pagrindiniai veikėjai

- **Client (užsakovas)**  
  Sukuria darbą, pasirenka freelancerį ir arbitrą, įneša sutartą sumą ETH į eskrovo sutartį ir vėliau patvirtina arba atmeta atliktą darbą.

- **Freelancer (laisvai samdomas darbuotojas)**  
  Priima darbą, jį atlieka ir pateikia rezultatą per išmaniąją sutartį.

- **Arbitrator (arbitras)**  
  Neutrali šalis, įsikišanti tik tada, kai kyla ginčas tarp kliento ir freelancerio. Arbitras nusprendžia, kam turi būti išmokėtos lėšos.

- **FreelanceEscrow išmanioji sutartis**  
  Laiko lėšas, saugo darbų būsenas ir tikrina, kad kiekvieną veiksmą atliktų tik tam skirta šalis (klientas, freelanceris arba arbitras).

### Duomenų modelis

Kiekvienas darbas (job) saugomas struktūroje `Job`:

- `uint256 id` – darbo identifikatorius.
- `address client` – užsakovo adresas.
- `address freelancer` – pasirinkto freelancerio adresas.
- `address arbitrator` – arbitro adresas.
- `uint256 amount` – depozito suma (ETH), kurią klientas įneša į sutartį.
- `JobStatus status` – darbo būsena.
- kiti pagalbiniai laukai (pvz. sukūrimo laikas, aprašymas ir pan., jei naudojama).

Darbo būsena aprašoma išvardijimu (`enum JobStatus`):

1. `Created` – klientas sukūrė darbą ir įnešė depozitą.
2. `Accepted` – freelanceris priėmė darbą.
3. `Submitted` – freelanceris pateikė atliktą darbą.
4. `Completed` – klientas patvirtino darbą, lėšos išmokėtos freelancer‘iui.
5. `Disputed` – klientas atmetė darbą ir iškėlė ginčą.
6. `Cancelled` – darbas atšauktas (pvz., nepriėmus darbo arba iki jo pradžios).

### Pagrindinės funkcijos ir verslo logika

#### 1. Darbo sukūrimas – `createJob`

1. Klientas suformuoja užsakymą: nurodo freelancerio ir arbitro adresus bei sumą **ETH**, kurią įneša į sutartį (`msg.value`).
2. Sutartis sukuria naują `Job` įrašą su būsena `Created`.
3. Sutartis emituoja įvykį `JobCreated`, kuris vėliau matomas „loguose“ (Ganache, Remix, Etherscan).

**Verslo prasmė:** lėšos iš karto atsiduria saugioje vietoje (eskrove), todėl freelanceris mato, kad užsakovas tikrai turi pinigų.

#### 2. Darbo priėmimas – `acceptJob`

1. Funkciją gali kviesti tik tas adresas, kuris nurodytas kaip `freelancer`.
2. Būsena keičiama iš `Created` į `Accepted`.
3. Emisijuojamas įvykis `JobAccepted`.

**Verslo prasmė:** freelanceris oficialiai sutinka atlikti darbą už sutartą sumą.

#### 3. Darbo pateikimas – `submitWork`

1. Funkciją gali kviesti tik freelanceris.
2. Būsena keičiama iš `Accepted` į `Submitted`.
3. Emisijuojamas įvykis `WorkSubmitted`.

**Verslo prasmė:** sutartis fiksuoja, kad freelanceris darbą baigė ir perdavė klientui per sistemą.

#### 4. Darbo patvirtinimas ir apmokėjimas – `approveWork`

1. Funkciją gali kviesti tik klientas.
2. Būsena keičiama į `Completed`.
3. Išmanioji sutartis perveda visą depozito sumą (`amount`) freelancerio adresui.
4. Emisijuojamas įvykis `JobCompleted`.

**Verslo prasmė:** įvyksta saugus atsiskaitymas – pinigai pervedami tik tada, kai klientas patenkintas rezultatu.

#### 5. Ginčas – `openDispute` ir `resolveDispute`

1. Jei klientas nepatenkintas darbu, jis kviečia `openDispute(jobId)`.  
   Būsena keičiama į `Disputed`, emituojamas įvykis `DisputeOpened`.
2. Arbitras peržiūri situaciją „off-chain“ (per el. paštą, dokumentus, kodą ir t. t.).
3. Arbitras kviečia `resolveDispute(jobId, releaseToFreelancer)`:
   - jei `releaseToFreelancer = true`, lėšos išmokamos freelancer‘iui;
   - jei `false`, lėšos grąžinamos klientui.
4. Būsena tampa `Completed`, emituojamas `DisputeResolved`.

**Verslo prasmė:** ginčo sprendimas patikėtas trečiajai šaliai, todėl nei klientas, nei freelanceris negali vienašališkai „pasisavinti“ lėšų.

#### 6. Atšaukimas – `cancelJob`

- Kol darbas dar nepradėtas (pvz., būsena `Created` ir nėra priėmimo), klientas gali atšaukti užsakymą.
- Būsena tampa `Cancelled`, depozitas grąžinamas klientui.

**Verslo prasmė:** apsauga nuo „užstrigusių“ darbų, kai freelanceris nepriima užsakymo.

## Verslo modelio šalių tarpusavio sąveikos sekų diagrama (sequence diagram)

![alt text](freelance-escrow-dapp/images/Sequence_diagram_Verslo_Modelio_ETH.drawio.png)

### Saugumo ir teisingumo užtikrinimas

- Naudojami **modifieriai** (`onlyClient`, `onlyFreelancer`, `onlyArbitrator`, `inStatus`), kurie užtikrina, kad:
  - kiekvieną funkciją gali kviesti tik jam priklausanti šalis,
  - operacijos atliekamos tik teisingoje būsenos sekoje (pvz., negalima patvirtinti darbo, kuris dar nebuvo pateiktas).
- Visi svarbūs veiksmai emituoja **event’us** (`JobCreated`, `JobAccepted`, `WorkSubmitted`, `JobCompleted`, `DisputeOpened`, `DisputeResolved`), kuriuos galima analizuoti Ganache, Remix ar Etherscan įrankiuose.


