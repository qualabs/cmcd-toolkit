# cmcd-toolkit

cmcd-toolkit is a set of basic tools to collect and analyze data sent by video with [CMCD v2](https://github.com/cta-wave/common-media-client-data) support.

This repository provides tools to collect and analize CMCD v2 locally and in different cloud providers.

## Project Modules

The project is organized into the following modules:

*   **collector**: Responsible for receiving, processing, and forwording CMCD data to a DB or storage instance. It can be configured to work with different backends like Fluentd or Google PubSub
*   **fluentd**: A data collector for unified logging. It's primarily used in the local setup to forward CMCD data from the `collector` to an InfluxDB instance for quick visualization with Grafana. It can be configured to output to other destinations like BigQuery or apply filters and data enrichment (like adding geoip data based on the user IP address)
*   **gcloud-big-table**: Contains the schema definition (`bigquery-cmcdv2-schema.json`) for storing CMCD data in **Google BigQuery** within the Google Cloud flavor.
*   **gcloud-collector-function**: A Google Cloud Function implementation of the CMCD collector. This is an alternative to the Docker-based collector for serverless deployments on Google Cloud.
*   **grafana**: Contains Grafana configurations for visualizing CMCD data. It includes dashboards for both local and Google Cloud setups.
*   **player**: A web-based video player based in dash.js used for testing and demonstrating CMCD data collection. It can be configured to send CMCD data to the collector.


## How to run localy

This setup allows you to run the cmcd-toolkit on your local machine using Docker.

This setup uses the following moduels: **player**, **collector**, **fluentd** and  **grafana**

How to run:
1. Run `docker compose up` (or `docker compose -f docker-compose.local.yml up`).
2. Player will be available at: [http://localhost:8080](http://localhost:8080), 
3. Press the "Collector" button to start sending CMCD v2 data to the local collector.
4. Play any DASH content in the player.
5. Login to grafana at [http://localhost:8080](http://localhost:8080)
   * User: `admin`
   * Password: `grafana`
6. Open a grafana dashboard to start analyzing the CMCD data from the player.


## How to deploy in Google Cloud

Deployment in Google Cloud:
![CMCD Toolkit Google Cloud Deployment Example](docs/gcloud-example.png)

Assuming you already have a Google Cloud account, the high-level steps to deploy are:
1. Create a CMCD [BigTable](https://cloud.google.com/bigtable) using schema found in the `gcloud-big-table` folder
2. Create a [Pub/Sub](https://cloud.google.com/pubsub) topic and a suscription to the CMCD BigTable
3. Create a [Cloud Run Function](https://cloud.google.com/functions) with the code found in `index.js` from `collector-gcloud-function`. This will give you a `{public url}` for the collector.
4. Configure in the palyer found in the `palyer` folder the following urls:
    * For response mode: `{public url}/cmcd/response-mode`
    * For event mode: `{public url}/cmcd/event-mode`
5. (Optional) Create a bucket in [Cloud Storage](https://cloud.google.com/storage) with public access and deploy the palyer for testing the system.
6. (Optional) Create a bucket in [Cloud Storage](https://cloud.google.com/storage) and suscribe to the Pub/Sub CMCD topic for long term CMCD storage.
7. (Optinal) Connect a Grafana instance using the BigQuery plugin. Find a Grafana config example in the `grafana` folder.

## How to use other players
To collect CMCD data from a player other than the one pre-configured in this project, you must configure CMCD v2 and set the response and event mode endpoints to the following URLs (Note that both `collector` and `gcloud-collector-function` have the same API): 

* CMCD Response mode: `{collector_domain}:{collector_port}/cmcd/response-mode`
* CMCD Event mode: `{collector_domain}:{collector_port}/cmcd/event-mode`


## How to develop

Copy `docker-comose.develop.yml` to `docker-compose.override.yml` and then run `docker compose up`. You will be able to modify the code while running the project

Notice: 
* If you are making changes in the `fluentd` configuraiton, you MAY need to delete the docker volume of influxdb to se the cahnges applied
* After changinge the codebase, you can run all the unit tests using this command: `docker compose -f docker-comose.test.yml up` 

## License

This project is licensed under the Apache 2.0 License. See the `LICENSE` file for more details.
