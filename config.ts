export const key = {
  SECRET_KEY: process.env.SECRET_KEY as string,
};

export const neo4jConfig = {
  uri: "bolt+s://neo4j.findconnections.net:7687",
  user: process.env.NEO4J_USER as string,
  password: process.env.NEO4J_PASSWORD as string,
};
