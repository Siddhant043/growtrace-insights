import amqp, {
  type Channel,
  type ChannelModel,
} from "amqplib";

import { env } from "../config/env.js";
import { createScopedLogger } from "../utils/logger.js";

const rabbitmqLogger = createScopedLogger("infrastructure.rabbitmq");

const buildRabbitMqConnectionUrl = (): string => {
  if (env.RABBITMQ_URL) {
    return env.RABBITMQ_URL;
  }
  const encodedUser = encodeURIComponent(env.RABBITMQ_DEFAULT_USER);
  const encodedPass = encodeURIComponent(env.RABBITMQ_DEFAULT_PASS);
  return `amqp://${encodedUser}:${encodedPass}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;
};

let cachedConnection: ChannelModel | null = null;
let cachedChannel: Channel | null = null;
let topologyAssertedFlag = false;

export const connectToRabbitMq = async (): Promise<ChannelModel> => {
  if (cachedConnection) {
    return cachedConnection;
  }

  const connectionUrl = buildRabbitMqConnectionUrl();
  cachedConnection = await amqp.connect(connectionUrl);

  cachedConnection.on("error", (connectionError) => {
    rabbitmqLogger.error("RabbitMQ connection error", {
      error:
        connectionError instanceof Error
          ? connectionError.message
          : String(connectionError),
    });
  });

  cachedConnection.on("close", () => {
    rabbitmqLogger.warn("RabbitMQ connection closed");
    cachedConnection = null;
    cachedChannel = null;
    topologyAssertedFlag = false;
  });

  rabbitmqLogger.info("Connected to RabbitMQ");
  return cachedConnection;
};

export const getRabbitMqChannel = async (): Promise<Channel> => {
  if (cachedChannel) {
    return cachedChannel;
  }

  const connection = await connectToRabbitMq();
  cachedChannel = await connection.createChannel();
  await cachedChannel.prefetch(env.WORKFLOW_LLM_PREFETCH);
  return cachedChannel;
};

export const assertWorkflowLlmTopology = async (): Promise<Channel> => {
  const channel = await getRabbitMqChannel();
  if (topologyAssertedFlag) {
    return channel;
  }

  await channel.assertExchange(env.WORKFLOW_LLM_EXCHANGE, "topic", {
    durable: true,
  });
  await channel.assertExchange(env.WORKFLOW_LLM_DLX_EXCHANGE, "topic", {
    durable: true,
  });

  await channel.assertQueue(env.WORKFLOW_LLM_DLQ, { durable: true });
  await channel.bindQueue(
    env.WORKFLOW_LLM_DLQ,
    env.WORKFLOW_LLM_DLX_EXCHANGE,
    env.WORKFLOW_LLM_DL_ROUTING_KEY,
  );

  await channel.assertQueue(env.WORKFLOW_LLM_REQUEST_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": env.WORKFLOW_LLM_DLX_EXCHANGE,
      "x-dead-letter-routing-key": env.WORKFLOW_LLM_DL_ROUTING_KEY,
    },
  });
  await channel.bindQueue(
    env.WORKFLOW_LLM_REQUEST_QUEUE,
    env.WORKFLOW_LLM_EXCHANGE,
    env.WORKFLOW_LLM_REQUEST_ROUTING_KEY,
  );

  await channel.assertQueue(env.WORKFLOW_LLM_RESPONSE_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": env.WORKFLOW_LLM_DLX_EXCHANGE,
      "x-dead-letter-routing-key": env.WORKFLOW_LLM_DL_ROUTING_KEY,
    },
  });
  await channel.bindQueue(
    env.WORKFLOW_LLM_RESPONSE_QUEUE,
    env.WORKFLOW_LLM_EXCHANGE,
    env.WORKFLOW_LLM_RESPONSE_ROUTING_KEY,
  );

  topologyAssertedFlag = true;
  rabbitmqLogger.info("Workflow LLM RabbitMQ topology asserted");
  return channel;
};

export const publishWorkflowGenerationResponse = async (
  payload: unknown,
): Promise<void> => {
  const channel = await assertWorkflowLlmTopology();
  const body = Buffer.from(JSON.stringify(payload), "utf-8");
  channel.publish(
    env.WORKFLOW_LLM_EXCHANGE,
    env.WORKFLOW_LLM_RESPONSE_ROUTING_KEY,
    body,
    { contentType: "application/json", persistent: true },
  );
};

export const closeRabbitMqResources = async (): Promise<void> => {
  if (cachedChannel) {
    try {
      await cachedChannel.close();
    } catch {
      // ignore
    }
    cachedChannel = null;
  }
  if (cachedConnection) {
    try {
      await cachedConnection.close();
    } catch {
      // ignore
    }
    cachedConnection = null;
  }
  topologyAssertedFlag = false;
};
