import amqp, {
  type Channel,
  type ChannelModel,
} from "amqplib";

import { env } from "../config/env";
import { createScopedLogger } from "../utils/logger";

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

  rabbitmqLogger.info("Connected to RabbitMQ", { url: connectionUrl });
  return cachedConnection;
};

export const getRabbitMqChannel = async (): Promise<Channel> => {
  if (cachedChannel) {
    return cachedChannel;
  }

  const connection = await connectToRabbitMq();
  cachedChannel = await connection.createChannel();

  cachedChannel.on("error", (channelError) => {
    rabbitmqLogger.error("RabbitMQ channel error", {
      error:
        channelError instanceof Error
          ? channelError.message
          : String(channelError),
    });
  });

  cachedChannel.on("close", () => {
    rabbitmqLogger.warn("RabbitMQ channel closed");
    cachedChannel = null;
    topologyAssertedFlag = false;
  });

  await cachedChannel.prefetch(env.INSIGHTS_PREFETCH);

  return cachedChannel;
};

/**
 * Idempotently asserts the analytics exchange, the consumer queue (with
 * DLX bindings), and the dead-letter pair. Safe to call repeatedly; the
 * `topologyAssertedFlag` guards against redundant work after the first run.
 */
export const assertInsightsTopology = async (): Promise<Channel> => {
  const channel = await getRabbitMqChannel();
  if (topologyAssertedFlag) {
    return channel;
  }

  await channel.assertExchange(env.INSIGHTS_EXCHANGE, "topic", {
    durable: true,
  });

  await channel.assertExchange(env.INSIGHTS_DEAD_LETTER_EXCHANGE, "topic", {
    durable: true,
  });

  await channel.assertQueue(env.INSIGHTS_DEAD_LETTER_QUEUE, {
    durable: true,
  });
  await channel.bindQueue(
    env.INSIGHTS_DEAD_LETTER_QUEUE,
    env.INSIGHTS_DEAD_LETTER_EXCHANGE,
    env.INSIGHTS_DEAD_LETTER_ROUTING_KEY,
  );

  await channel.assertQueue(env.INSIGHTS_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": env.INSIGHTS_DEAD_LETTER_EXCHANGE,
      "x-dead-letter-routing-key": env.INSIGHTS_DEAD_LETTER_ROUTING_KEY,
    },
  });
  await channel.bindQueue(
    env.INSIGHTS_QUEUE,
    env.INSIGHTS_EXCHANGE,
    env.INSIGHTS_ROUTING_KEY,
  );

  topologyAssertedFlag = true;

  rabbitmqLogger.info("Insights RabbitMQ topology asserted", {
    exchange: env.INSIGHTS_EXCHANGE,
    queue: env.INSIGHTS_QUEUE,
    deadLetterExchange: env.INSIGHTS_DEAD_LETTER_EXCHANGE,
    deadLetterQueue: env.INSIGHTS_DEAD_LETTER_QUEUE,
    routingKey: env.INSIGHTS_ROUTING_KEY,
  });

  return channel;
};

export const closeRabbitMqResources = async (): Promise<void> => {
  if (cachedChannel) {
    try {
      await cachedChannel.close();
    } catch (closeError) {
      rabbitmqLogger.warn("Failed to close channel cleanly", {
        error:
          closeError instanceof Error
            ? closeError.message
            : String(closeError),
      });
    }
    cachedChannel = null;
  }
  if (cachedConnection) {
    try {
      await cachedConnection.close();
    } catch (closeError) {
      rabbitmqLogger.warn("Failed to close connection cleanly", {
        error:
          closeError instanceof Error
            ? closeError.message
            : String(closeError),
      });
    }
    cachedConnection = null;
  }
  topologyAssertedFlag = false;
};
